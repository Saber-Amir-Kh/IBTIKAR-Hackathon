import os
import time
import threading
import cv2
import numpy as np
from datetime import datetime

class StreamIngester:
    """
    Resilient video ingest thread that captures from STREAM_URL (or local webcam).
    Auto-reconnects every 2s on failure.
    If no camera is available, synthesizes a realistic surveillance stream
    so the demo NEVER crashes and the MJPEG proxy feed always displays smooth video.
    """
    def __init__(self, stream_url: str):
        self.raw_stream_url = stream_url
        self.lock = threading.Lock()
        self.current_frame = None
        self.is_real_stream = False
        self.source_description = "Initialisation..."
        self.running = True
        self.simulated_fire_active = False
        self.simulated_fire_until = 0.0

        # Background thread
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def _parse_source(self):
        clean = str(self.raw_stream_url).split("#")[0].strip()
        if clean.isdigit():
            return int(clean)
        return clean

    def _capture_loop(self):
        while self.running:
            source = self._parse_source()
            cap = None
            try:
                if isinstance(source, int):
                    self.source_description = f"Webcam PC (Périphérique {source})"
                    print(f"[Ingest] === Ouverture de la webcam PC index {source} (DirectShow)... ===")
                    # DirectShow is optimal and instant on Windows
                    if os.name == 'nt':
                        cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
                    else:
                        cap = cv2.VideoCapture(source)
                else:
                    self.source_description = f"Flux Réseau ({source})"
                    print(f"[Ingest] Connexion au flux vidéo réseau : {source}...")
                    cap = cv2.VideoCapture(source)

                # Verify connection
                start_t = time.time()
                connected = False

                while (time.time() - start_t) < 3.0:
                    if cap.isOpened():
                        ret, frame = cap.read()
                        if ret and frame is not None and frame.size > 0:
                            connected = True
                            break
                    time.sleep(0.15)

                if connected:
                    print(f"[Ingest] >>> SUCCÈS : Connecté à la caméra réelle [{self.source_description}] ! <<<")
                    self.is_real_stream = True

                    while self.running:
                        ret, frame = cap.read()
                        if not ret or frame is None:
                            print(f"[Ingest] Perte du signal caméra ({self.source_description}). Tentative de reconnexion...")
                            break

                        # Resize if too large for fast inference
                        h, w = frame.shape[:2]
                        if w > 800:
                            frame = cv2.resize(frame, (640, 480))

                        with self.lock:
                            self.current_frame = frame

                        time.sleep(0.025) # ~30-40 fps
                else:
                    print(f"[Ingest] Impossible d'ouvrir la caméra réelle [{self.source_description}]. Activation du flux de secours synthétique...")
                    self.is_real_stream = False
                    self.source_description = "Surveillance Synthétique (Djurdjura/Tikjda)"
                    self._generate_synthetic_frames(duration_sec=3.0)

            except Exception as e:
                self.is_real_stream = False
                self.source_description = "Surveillance Synthétique (Secours)"
                print(f"[Ingest] Erreur capture ({e}). Génération du flux de secours...")
                self._generate_synthetic_frames(duration_sec=3.0)
            finally:
                if cap is not None:
                    cap.release()

    def _generate_synthetic_frames(self, duration_sec: float):
        end_time = time.time() + duration_sec
        w, h = 640, 480
        t_tick = 0

        while self.running and time.time() < end_time:
            t_tick += 1
            frame = np.zeros((h, w, 3), dtype=np.uint8)

            # Sky gradient
            for y in range(220):
                ratio = y / 220.0
                b = int(170 * (1 - ratio) + 140 * ratio)
                g = int(140 * (1 - ratio) + 170 * ratio)
                r = int(90 * (1 - ratio) + 210 * ratio)
                frame[y, :] = (b, g, r)

            # Mountains
            pts1 = np.array([[0, 210], [140, 140], [300, 180], [460, 120], [640, 200], [640, 480], [0, 480]], np.int32)
            cv2.fillPoly(frame, [pts1], (60, 80, 50))

            pts2 = np.array([[0, 260], [180, 190], [360, 230], [520, 180], [640, 240], [640, 480], [0, 480]], np.int32)
            cv2.fillPoly(frame, [pts2], (35, 55, 30))

            cv2.ellipse(frame, (320, 450), (450, 180), 0, 0, 360, (25, 45, 20), -1)

            # Fire simulation if triggered
            now = time.time()
            if self.simulated_fire_active and now < self.simulated_fire_until:
                for i in range(12):
                    sx = int(320 + np.sin(t_tick * 0.2 + i) * 20 + (i * 2))
                    sy = int(220 - i * 12)
                    rad = int(15 + i * 4)
                    overlay = frame.copy()
                    cv2.circle(overlay, (sx, sy), rad, (130, 130, 130), -1)
                    cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

                for j in range(8):
                    fx = int(320 + (np.random.rand() - 0.5) * 25)
                    fy = int(220 - (np.random.rand()) * 30)
                    frad = int(8 + np.random.rand() * 12)
                    color = (0, int(100 + np.random.rand() * 120), 255)
                    cv2.circle(frame, (fx, fy), frad, color, -1)
            else:
                self.simulated_fire_active = False

            with self.lock:
                self.current_frame = frame

            time.sleep(0.04)

    def trigger_simulated_fire(self, duration_sec: float = 6.0):
        self.simulated_fire_active = True
        self.simulated_fire_until = time.time() + duration_sec

    def get_latest_frame(self) -> np.ndarray:
        with self.lock:
            if self.current_frame is not None:
                return self.current_frame.copy()
            return np.zeros((480, 640, 3), dtype=np.uint8)

    def stop(self):
        self.running = False
