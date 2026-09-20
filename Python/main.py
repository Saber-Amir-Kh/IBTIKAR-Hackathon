import os
import sys
import time
import threading
from datetime import datetime, timezone
import cv2
import numpy as np
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
import uvicorn

from detector import CompositeFireDetector
from stream_ingest import StreamIngester
from tracker import SpatialFireTracker, TrackedFireArea

load_dotenv()

# Parse STREAM_URL cleanly
raw_stream = os.getenv("STREAM_URL", "0")
clean_stream = str(raw_stream).split("#")[0].strip()
STREAM_URL = clean_stream

SPRING_URL = os.getenv("SPRING_URL", "http://localhost:8080")
AI_PORT = int(os.getenv("AI_PORT", "8001"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.70"))
SUSTAINED_SECONDS = float(os.getenv("SUSTAINED_SECONDS", "2.0"))
MEMORY_GRACE_SECONDS = float(os.getenv("MEMORY_GRACE_SECONDS", "0.8"))
COOLDOWN_SECONDS = float(os.getenv("COOLDOWN_SECONDS", "15.0"))
FRAME_SKIP = int(os.getenv("FRAME_SKIP", "2"))
SNAPSHOTS_DIR = os.getenv("SNAPSHOTS_DIR", "./snapshots")

os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

# ----------------- FASTAPI SETUP -----------------
app = FastAPI(
    title="Sentinelle Algérie — Microservice Vision IA",
    description="Capteur de vision par ordinateur pour détection de feux et fumées avec suivi spatial et mémoire de persistance.",
    version="1.4.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ingester = StreamIngester(STREAM_URL)
detector = CompositeFireDetector()
fire_tracker = SpatialFireTracker(
    sustained_seconds=SUSTAINED_SECONDS,
    memory_grace_seconds=MEMORY_GRACE_SECONDS,
    confidence_threshold=CONFIDENCE_THRESHOLD
)

state_lock = threading.Lock()
last_trigger_time = 0.0
total_detections_fired = 0
latest_detections = []
latest_tracked_areas = []
latest_mean_luma = 80.0
latest_dynamic_threshold = CONFIDENCE_THRESHOLD
latest_display_frame = None

def post_to_spring_with_retries(payload: dict, max_retries: int = 3):
    url = f"{SPRING_URL}/api/detections"
    for attempt in range(1, max_retries + 1):
        try:
            print(f"[Webhook] Transmission à Spring Boot ({url}) - Tentative {attempt}/{max_retries}...")
            resp = requests.post(url, json=payload, timeout=3.0)
            if resp.status_code in (200, 201):
                data = resp.json()
                print(f"[Webhook] >>> SUCCÈS ! Incident #{data.get('id')} créé dans Spring Boot ({data.get('severity')}) <<<")
                return True
            else:
                print(f"[Webhook] Spring a répondu statut {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"[Webhook] Tentative {attempt} échouée : {e}")
        time.sleep(1.0)

    print("[Webhook] Alerte abandonnée après 3 tentatives (Spring Boot injoignable).")
    return False

@app.get("/health")
def health():
    now = time.time()
    with state_lock:
        top_area = fire_tracker.get_highest_sustained_area()
        curr_sustained = round(top_area.sustained_duration, 2) if top_area else 0.0
        in_memory = top_area.in_memory_hold if top_area else False
        areas_count = len(fire_tracker.tracks)
        dets_count = len(latest_detections)
        c_rem = max(0, int(COOLDOWN_SECONDS - (now - last_trigger_time)))
        mean_l = round(latest_mean_luma, 1)
        eff_th = fire_tracker.current_effective_threshold
        l_mode = "ELEVEE (Chambre eclaree)" if mean_l >= 125 else ("BASSE (Sombre)" if mean_l < 60 else "NORMALE")

    return {
        "status": "healthy",
        "service": "algeria-wildfire-ai-sensor",
        "stream_url": STREAM_URL,
        "source_description": ingester.source_description,
        "is_real_camera": ingester.is_real_stream,
        "confidence_threshold_base": CONFIDENCE_THRESHOLD,
        "dynamic_confidence_threshold": eff_th,
        "ambient_luminance": mean_l,
        "lighting_mode": l_mode,
        "sustained_seconds_target": SUSTAINED_SECONDS,
        "sustained_seconds_current": curr_sustained,
        "memory_grace_seconds": MEMORY_GRACE_SECONDS,
        "in_memory_retention": in_memory,
        "tracked_areas_count": areas_count,
        "total_detections_fired": total_detections_fired,
        "cooldown_remaining_sec": c_rem,
        "detections_count": dets_count
    }

def generate_mjpeg():
    while True:
        with state_lock:
            frame = latest_display_frame if latest_display_frame is not None else ingester.get_latest_frame()

        ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ret:
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")
        time.sleep(0.035)

@app.get("/proxy_feed")
def proxy_feed():
    return StreamingResponse(
        generate_mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/snapshots/{filename}")
def get_snapshot(filename: str):
    path = os.path.join(SNAPSHOTS_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Snapshot non trouvé")

@app.post("/test_trigger")
def test_trigger(seconds: float = 6.0):
    ingester.trigger_simulated_fire(duration_sec=seconds)
    return {"status": "ok", "message": f"Flamme simulée injectée pendant {seconds}s."}

class StandaloneServer(uvicorn.Server):
    """Custom Uvicorn server that skips signal handler registration so it runs in background thread."""
    def install_signal_handlers(self):
        pass

def start_fastapi():
    """Starts FastAPI in a background daemon thread."""
    try:
        config = uvicorn.Config(app, host="0.0.0.0", port=AI_PORT, log_level="warning")
        server = StandaloneServer(config)
        print(f"[FastAPI] Serveur web prêt sur http://localhost:{AI_PORT} (Flux vidéo: http://localhost:{AI_PORT}/proxy_feed)")
        server.run()
    except Exception as e:
        print(f"[FastAPI] Erreur démarrage serveur sur le port {AI_PORT}: {e}")

# ----------------- MAIN DESKTOP GUI & INFERENCE LOOP -----------------
def main():
    global last_trigger_time, total_detections_fired, latest_detections, latest_tracked_areas, latest_display_frame, latest_mean_luma, latest_dynamic_threshold

    # Start FastAPI background server
    api_thread = threading.Thread(target=start_fastapi, daemon=True)
    api_thread.start()
    time.sleep(0.8)

    window_title = "Sentinelle Algerie -- IA Vision Feu en Direct (Touche Q pour quitter)"
    try:
        cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_title, 800, 600)
    except Exception as e:
        print(f"[OpenCV] Notice: {e}")

    print("\n" + "="*70)
    print("  SENTINELLE ALGÉRIE -- VISION IA DÉTECTION FEU DE FORÊT")
    print("="*70)
    print(f"  * Source vidéo     : {STREAM_URL} ({ingester.source_description})")
    print(f"  * Port serveur API : http://localhost:{AI_PORT}")
    print(f"  * Flux Web React   : http://localhost:{AI_PORT}/proxy_feed")
    print(f"  * Seuil alerte     : >= {int(CONFIDENCE_THRESHOLD*100)}% pendant >= {SUSTAINED_SECONDS:.1f}s")
    print(f"  * Mémoire spatiale : {MEMORY_GRACE_SECONDS:.1f}s de rétention lors des scintillements")
    print(f"  * Fenêtre OpenCV   : OUVERTE sur votre écran !")
    print(f"  * Pour tester      : Présentez une image de feu, briquet ou vidéo")
    print("="*70 + "\n")

    frame_counter = 0

    while True:
        raw_frame = ingester.get_latest_frame()
        if raw_frame is None or raw_frame.size == 0:
            time.sleep(0.03)
            continue

        frame_counter += 1
        now = time.time()
        cooldown_remaining = max(0, int(COOLDOWN_SECONDS - (now - last_trigger_time)))
        cooldown_active = cooldown_remaining > 0

        # Run inference every FRAME_SKIP frames
        if frame_counter % FRAME_SKIP == 0:
            gray = cv2.cvtColor(raw_frame, cv2.COLOR_BGR2GRAY)
            mean_luma = float(np.mean(gray))

            detections = detector.detect(raw_frame)
            tracked_areas = fire_tracker.update(detections, now, mean_luma=mean_luma)

            with state_lock:
                latest_detections = detections
                latest_tracked_areas = tracked_areas
                latest_mean_luma = mean_luma
                latest_dynamic_threshold = fire_tracker.current_effective_threshold

            # Check if any tracked area satisfies the 2.0s constraint!
            ready_areas = fire_tracker.get_ready_to_trigger_areas(cooldown_active)

            for area in ready_areas:
                print(f"\n[IA Vision] >>> 🔥🔥🔥 DÉPART DE FEU CONFIRMÉ DANS LA ZONE #{area.track_id} (Soutenu {area.sustained_duration:.1f}s >= {SUSTAINED_SECONDS:.1f}s à {area.confidence*100:.1f}%) ! ENVOI DU WEBHOOK À SPRING BOOT ! 🔥🔥🔥\n")
                timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"detection_{timestamp_str}.jpg"
                snapshot_path = os.path.join(SNAPSHOTS_DIR, filename)

                # Save snapshot with bounding box
                snap = raw_frame.copy()
                b = area.box
                cv2.rectangle(snap, (b[0], b[1]), (b[2], b[3]), (0, 0, 255), 3)
                cv2.putText(snap, f"{area.label.upper()} {area.confidence*100:.0f}% (Zone #{area.track_id} - {area.sustained_duration:.1f}s)",
                            (b[0], max(20, b[1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                cv2.imwrite(snapshot_path, snap)

                payload = {
                    "label": area.label,
                    "confidence": round(area.confidence, 2),
                    "snapshotUrl": f"http://localhost:{AI_PORT}/snapshots/{filename}",
                    "detectedAt": datetime.now(timezone.utc).isoformat()
                }

                threading.Thread(target=post_to_spring_with_retries, args=(payload,), daemon=True).start()

                area.triggered = True
                last_trigger_time = now
                total_detections_fired += 1

        # Build visual HUD frame
        display_frame = raw_frame.copy()
        h, w = display_frame.shape[:2]

        with state_lock:
            current_dets = list(latest_detections)
            current_areas = list(latest_tracked_areas)
            top_area = fire_tracker.get_highest_sustained_area()
            curr_eff_thresh = fire_tracker.current_effective_threshold
            curr_luma = latest_mean_luma

        # 1. Draw raw low-confidence candidate detections (below dynamic threshold)
        for d in current_dets:
            if d.get("confidence", 0) < curr_eff_thresh:
                b = d["box"]
                cv2.rectangle(display_frame, (b[0], b[1]), (b[2], b[3]), (100, 100, 100), 1)
                lbl = f"{d['label']}: {d['confidence']*100:.0f}%"
                cv2.putText(display_frame, lbl, (b[0], max(15, b[1] - 4)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA)

        # 2. Draw Tracked Fire Areas with spatial overlap & memory retention!
        for area in current_areas:
            b = area.box
            is_confirmed = area.sustained_duration >= SUSTAINED_SECONDS
            in_memory = area.in_memory_hold

            # Color coding:
            # - Red (0, 0, 255) if confirmed (>= 2s)
            # - Orange/Amber (0, 165, 255) if in memory hold (stutter/flicker grace period)
            # - Orange-Red (0, 100, 255) if actively accumulating sustained duration
            if is_confirmed:
                box_color = (0, 0, 255)
                box_thickness = 3
                lbl_text = f"CONFIRME ({area.sustained_duration:.1f}s) #{area.track_id}"
            elif in_memory:
                box_color = (0, 165, 255)
                box_thickness = 2
                lbl_text = f"[MEM: {area.memory_duration:.1f}s] {area.label.upper()} {area.confidence*100:.0f}% ({area.sustained_duration:.1f}s/{SUSTAINED_SECONDS:.1f}s)"
            else:
                box_color = (0, 100, 255)
                box_thickness = 3
                lbl_text = f"{area.label.upper()} {area.confidence*100:.0f}% ({area.sustained_duration:.1f}s/{SUSTAINED_SECONDS:.1f}s)"

            cv2.rectangle(display_frame, (b[0], b[1]), (b[2], b[3]), box_color, box_thickness)

            (tw, th), _ = cv2.getTextSize(lbl_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            cv2.rectangle(display_frame, (b[0], max(0, b[1] - th - 10)), (b[0] + tw + 12, max(th + 10, b[1])), box_color, -1)
            cv2.putText(display_frame, lbl_text, (b[0] + 6, max(th + 4, b[1] - 4)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)

            # Mini Progress Bar on the bounding box
            prog_pct = min(1.0, area.sustained_duration / SUSTAINED_SECONDS)
            bar_w = max(60, min(b[2] - b[0], 200))
            bar_h = 6
            bar_x = b[0]
            bar_y = min(h - 10, b[3] + 4)
            cv2.rectangle(display_frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (30, 30, 30), -1)
            fill_color = (0, 255, 0) if is_confirmed else ((0, 165, 255) if in_memory else (0, 120, 255))
            cv2.rectangle(display_frame, (bar_x, bar_y), (bar_x + int(bar_w * prog_pct), bar_y + bar_h), fill_color, -1)
            cv2.rectangle(display_frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (200, 200, 200), 1)

        # Top OSD Bar
        cv2.rectangle(display_frame, (0, 0), (w, 36), (15, 23, 42), -1)
        src_color = (0, 255, 128) if ingester.is_real_stream else (0, 180, 255)
        luma_mode_tag = "LUM: ELEVEE" if curr_luma >= 125 else ("LUM: BASSE" if curr_luma < 60 else "LUM: NORMALE")
        osd_text = f"SOURCE: {ingester.source_description.upper()} | {luma_mode_tag} (L={int(curr_luma)}) | SEUIL: >={int(curr_eff_thresh*100)}% ({SUSTAINED_SECONDS:.1f}s) | MEM: {MEMORY_GRACE_SECONDS:.1f}s"
        cv2.putText(display_frame, osd_text, (12, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.43, src_color, 1, cv2.LINE_AA)
        cv2.putText(display_frame, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), (w - 185, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (220, 220, 220), 1, cv2.LINE_AA)

        # Bottom Telemetry Bar
        cv2.rectangle(display_frame, (0, h - 36), (w, h), (15, 23, 42), -1)
        if top_area:
            is_conf = top_area.sustained_duration >= SUSTAINED_SECONDS
            if is_conf:
                stat_color = (0, 0, 255)
                stat_text = f"DEPART DE FEU CONFIRME (Zone #{top_area.track_id} >= {SUSTAINED_SECONDS:.1f}s) ! TRANSMISSION EN COURS"
            elif top_area.in_memory_hold:
                stat_color = (0, 165, 255) # Amber
                stat_text = f"MEMOIRE ACTIVE ({top_area.memory_duration:.1f}s/{MEMORY_GRACE_SECONDS:.1f}s) | ZONE #{top_area.track_id}: {top_area.sustained_duration:.1f}s/{SUSTAINED_SECONDS:.1f}s | CD: {'ACTIF ('+str(cooldown_remaining)+'s)' if cooldown_remaining > 0 else 'PRET'}"
            else:
                stat_color = (0, 120, 255) # Orange
                stat_text = f"FLAMME SOUTENUE ({top_area.confidence*100:.0f}%) | ZONE #{top_area.track_id}: {top_area.sustained_duration:.1f}s/{SUSTAINED_SECONDS:.1f}s | CD: {'ACTIF ('+str(cooldown_remaining)+'s)' if cooldown_remaining > 0 else 'PRET'}"

            # Draw progress bar on bottom right
            prog_pct = min(1.0, top_area.sustained_duration / SUSTAINED_SECONDS)
            prog_w = int(prog_pct * 140)
            cv2.rectangle(display_frame, (w - 160, h - 24), (w - 160 + prog_w, h - 12), stat_color, -1)
            cv2.rectangle(display_frame, (w - 160, h - 24), (w - 20, h - 12), (255, 255, 255), 1)
        else:
            stat_color = (0, 255, 128)
            stat_text = f"SURVEILLANCE ACTIVE | AUCUN FEU | CD: {'ACTIF ('+str(cooldown_remaining)+'s)' if cooldown_remaining > 0 else 'PRET'}"

        cv2.putText(display_frame, stat_text, (12, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.44, stat_color, 1, cv2.LINE_AA)

        with state_lock:
            latest_display_frame = display_frame

        # Show desktop window!
        try:
            cv2.imshow(window_title, display_frame)
            key = cv2.waitKey(1) & 0xFF
            if key == 27 or key == ord('q'): # ESC or Q to quit
                print("[AI Vision] Fermeture de la fenêtre demandée par l'utilisateur.")
                break
        except Exception:
            pass

    ingester.stop()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
