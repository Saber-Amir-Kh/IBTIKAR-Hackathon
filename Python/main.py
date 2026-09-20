import os
import sys
import time
import threading
from datetime import datetime, timezone
import cv2
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
import uvicorn

from detector import CompositeFireDetector
from stream_ingest import StreamIngester

load_dotenv()

# Parse STREAM_URL cleanly
raw_stream = os.getenv("STREAM_URL", "0")
clean_stream = str(raw_stream).split("#")[0].strip()
STREAM_URL = clean_stream

SPRING_URL = os.getenv("SPRING_URL", "http://localhost:8080")
AI_PORT = int(os.getenv("AI_PORT", "8001"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.70"))
SUSTAINED_SECONDS = float(os.getenv("SUSTAINED_SECONDS", "2.0"))
COOLDOWN_SECONDS = float(os.getenv("COOLDOWN_SECONDS", "15.0"))
FRAME_SKIP = int(os.getenv("FRAME_SKIP", "2"))
SNAPSHOTS_DIR = os.getenv("SNAPSHOTS_DIR", "./snapshots")

os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

# ----------------- FASTAPI SETUP -----------------
app = FastAPI(
    title="Sentinelle Algérie — Microservice Vision IA",
    description="Capteur de vision par ordinateur pour détection de feux et fumées.",
    version="1.3.0"
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

state_lock = threading.Lock()
fire_first_seen_time = None
fire_last_seen_time = 0.0
sustained_duration = 0.0
last_trigger_time = 0.0
total_detections_fired = 0
latest_detections = []
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
    curr_sustained = round(now - fire_first_seen_time, 2) if fire_first_seen_time is not None else 0.0
    return {
        "status": "healthy",
        "service": "algeria-wildfire-ai-sensor",
        "stream_url": STREAM_URL,
        "source_description": ingester.source_description,
        "is_real_camera": ingester.is_real_stream,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "sustained_seconds_target": SUSTAINED_SECONDS,
        "sustained_seconds_current": curr_sustained,
        "total_detections_fired": total_detections_fired,
        "cooldown_remaining_sec": max(0, int(COOLDOWN_SECONDS - (now - last_trigger_time))),
        "detections_count": len(latest_detections)
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
    global fire_first_seen_time, fire_last_seen_time, sustained_duration, last_trigger_time, total_detections_fired, latest_detections, latest_display_frame

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
    print(f"  * Seuil alerte     : >= {int(CONFIDENCE_THRESHOLD*100)}% pendant >= {SUSTAINED_SECONDS:.1f} secondes")
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

        # Run inference every FRAME_SKIP frames
        if frame_counter % FRAME_SKIP == 0:
            detections = detector.detect(raw_frame)
            with state_lock:
                latest_detections = detections

            # Qualifying detections: confidence >= CONFIDENCE_THRESHOLD (0.70)
            qualifying = [d for d in detections if d["confidence"] >= CONFIDENCE_THRESHOLD]
            now = time.time()
            cooldown_remaining = max(0, int(COOLDOWN_SECONDS - (now - last_trigger_time)))
            cooldown_active = cooldown_remaining > 0

            if qualifying:
                top_det = qualifying[0]
                if fire_first_seen_time is None:
                    fire_first_seen_time = now
                fire_last_seen_time = now
                sustained_duration = now - fire_first_seen_time

                print(f"[IA Vision] FLAMME DÉTECTÉE ! Confiance: {top_det['confidence']*100:.1f}% | Soutenu: {sustained_duration:.2f}s/{SUSTAINED_SECONDS:.1f}s | Cooldown: {cooldown_remaining}s")

                if sustained_duration >= SUSTAINED_SECONDS:
                    if not cooldown_active:
                        print(f"\n[IA Vision] >>> 🔥🔥🔥 DÉPART DE FEU CONFIRMÉ (Soutenu {sustained_duration:.1f}s >= {SUSTAINED_SECONDS:.1f}s à {top_det['confidence']*100:.1f}%) ! ENVOI DU WEBHOOK À SPRING BOOT ! 🔥🔥🔥\n")
                        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"detection_{timestamp_str}.jpg"
                        snapshot_path = os.path.join(SNAPSHOTS_DIR, filename)

                        # Save snapshot with bounding boxes
                        snap = raw_frame.copy()
                        for d in qualifying:
                            b = d["box"]
                            cv2.rectangle(snap, (b[0], b[1]), (b[2], b[3]), (0, 0, 255), 3)
                            cv2.putText(snap, f"{d['label'].upper()} {d['confidence']*100:.0f}% ({sustained_duration:.1f}s)",
                                        (b[0], max(20, b[1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                        cv2.imwrite(snapshot_path, snap)

                        payload = {
                            "label": top_det["label"],
                            "confidence": round(top_det["confidence"], 2),
                            "snapshotUrl": f"http://localhost:{AI_PORT}/snapshots/{filename}",
                            "detectedAt": datetime.now(timezone.utc).isoformat()
                        }

                        threading.Thread(target=post_to_spring_with_retries, args=(payload,), daemon=True).start()

                        last_trigger_time = now
                        total_detections_fired += 1
                    else:
                        print(f"[IA Vision] Flamme soutenue ({sustained_duration:.1f}s) mais cooldown anti-spam actif ({cooldown_remaining}s restantes).")

                    # Reset timer after firing
                    fire_first_seen_time = None
                    sustained_duration = 0.0
            else:
                # If no fire seen for more than 0.6 seconds (grace period against camera flicker)
                if fire_first_seen_time is not None and (now - fire_last_seen_time > 0.6):
                    fire_first_seen_time = None
                    sustained_duration = 0.0

        # Build visual HUD frame
        display_frame = raw_frame.copy()
        h, w = display_frame.shape[:2]

        with state_lock:
            current_dets = list(latest_detections)
            s_duration = sustained_duration
            now = time.time()
            c_rem = max(0, int(COOLDOWN_SECONDS - (now - last_trigger_time)))

        # Draw detected bounding boxes
        for d in current_dets:
            b = d["box"]
            color = (0, 0, 255) if d["label"] == "fire" else (180, 180, 180)
            cv2.rectangle(display_frame, (b[0], b[1]), (b[2], b[3]), color, 3)
            lbl = f"{d['label'].upper()}: {d['confidence']*100:.0f}%"
            cv2.rectangle(display_frame, (b[0], max(0, b[1] - 25)), (b[0] + 160, max(25, b[1])), color, -1)
            cv2.putText(display_frame, lbl, (b[0] + 6, max(18, b[1] - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)

        # Top OSD Bar
        cv2.rectangle(display_frame, (0, 0), (w, 36), (15, 23, 42), -1)
        src_color = (0, 255, 128) if ingester.is_real_stream else (0, 180, 255)
        cv2.putText(display_frame, f"SOURCE: {ingester.source_description.upper()} | SEUIL: >={int(CONFIDENCE_THRESHOLD*100)}% (2.0s)", (12, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, src_color, 1, cv2.LINE_AA)
        cv2.putText(display_frame, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), (w - 185, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1, cv2.LINE_AA)

        # Bottom Telemetry Bar
        cv2.rectangle(display_frame, (0, h - 36), (w, h), (15, 23, 42), -1)
        if current_dets:
            top_c = current_dets[0]['confidence']
            if top_c >= CONFIDENCE_THRESHOLD:
                if s_duration >= SUSTAINED_SECONDS:
                    stat_color = (0, 0, 255) # Red
                    stat_text = f"DEPART DE FEU CONFIRME (>= 2s) ! TRANSMISSION EN COURS ({top_c*100:.0f}%)"
                else:
                    stat_color = (0, 165, 255) # Amber / Orange
                    stat_text = f"ANOMALIE DETECTEE ({top_c*100:.0f}%) | CONFIRMATION: {s_duration:.1f}s/{SUSTAINED_SECONDS:.1f}s | CD: {'ACTIF ('+str(c_rem)+'s)' if c_rem > 0 else 'PRET'}"
                    # Draw a mini progress bar on the right side of the bottom bar
                    prog_pct = min(1.0, s_duration / SUSTAINED_SECONDS)
                    prog_w = int(prog_pct * 140)
                    cv2.rectangle(display_frame, (w - 160, h - 24), (w - 160 + prog_w, h - 12), (0, 165, 255), -1)
                    cv2.rectangle(display_frame, (w - 160, h - 24), (w - 20, h - 12), (255, 255, 255), 1)
            else:
                stat_color = (0, 255, 255) # Yellow
                stat_text = f"TRACE VISUELLE ({top_c*100:.0f}% < {int(CONFIDENCE_THRESHOLD*100)}% SEUIL) | SURVEILLANCE NORMALE"
        else:
            stat_color = (0, 255, 128) # Green
            stat_text = f"SURVEILLANCE ACTIVE | AUCUN FEU | CD: {'ACTIF ('+str(c_rem)+'s)' if c_rem > 0 else 'PRET'}"

        cv2.putText(display_frame, stat_text, (12, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.46, stat_color, 1, cv2.LINE_AA)

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
