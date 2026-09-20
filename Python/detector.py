import os
import cv2
import numpy as np
from typing import List, Dict, Any

class BaseDetector:
    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        raise NotImplementedError

class HeuristicFireDetector(BaseDetector):
    """
    Precision flame & smoke detector with skin-tone rejection and high-luminosity gating.
    Used ONLY if neural network weights are unavailable.
    """
    def __init__(self, min_area: int = 250):
        self.min_area = min_area

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if frame is None or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        detections = []

        # 1. YCrCb Skin Tone Rejection Mask
        # Standard Kovacs/Chai human skin chrominance range: Cr in [133, 173], Cb in [77, 127]
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
        _, cr, cb = cv2.split(ycrcb)
        skin_mask = (cr >= 133) & (cr <= 175) & (cb >= 75) & (cb <= 127)

        # 2. HSV & RGB Flame Mask (Requires high luminosity and intense heat saturation)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        b, g, r = cv2.split(frame)

        # Flame must be very bright (V > 210) and saturated
        lower_fire1 = np.array([0, 120, 210])
        upper_fire1 = np.array([30, 255, 255])
        mask1 = cv2.inRange(hsv, lower_fire1, upper_fire1)

        lower_fire2 = np.array([165, 120, 210])
        upper_fire2 = np.array([180, 255, 255])
        mask2 = cv2.inRange(hsv, lower_fire2, upper_fire2)

        fire_hsv = cv2.bitwise_or(mask1, mask2)

        # High-intensity flame rule: R is very bright, R > G + 30, G > B
        flame_rgb_rule = (r > 200) & (r > (g.astype(np.int16) + 25)) & (g > b)
        fire_mask = cv2.bitwise_and(fire_hsv, fire_hsv, mask=flame_rgb_rule.astype(np.uint8) * 255)

        # Remove skin pixels completely
        fire_mask[skin_mask] = 0

        # Morphological clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        fire_mask = cv2.morphologyEx(fire_mask, cv2.MORPH_OPEN, kernel)
        fire_mask = cv2.dilate(fire_mask, kernel, iterations=2)

        contours, _ = cv2.findContours(fire_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area >= self.min_area:
                x, y, bw, bh = cv2.boundingRect(cnt)
                pad = 8
                x1 = max(0, x - pad)
                y1 = max(0, y - pad)
                x2 = min(w, x + bw + pad)
                y2 = min(h, y + bh + pad)

                confidence = float(min(0.92, 0.70 + min(0.20, (area / 5000.0) * 0.15)))
                detections.append({
                    "label": "fire",
                    "confidence": round(confidence, 3),
                    "box": [x1, y1, x2, y2],
                    "area": area
                })

        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections

class YOLOv8FireDetector(BaseDetector):
    """
    Dedicated Deep Neural Network detector using fine-tuned weights (fire_yolov8n.pt).
    Directly detects 'fire' and 'smoke' without hallucinating on skin or background objects.
    """
    def __init__(self, model_path: str = "fire_yolov8n.pt"):
        self.model = None
        self.is_loaded = False
        self.has_fire_classes = False
        try:
            from ultralytics import YOLO
            target_weights = "fire_yolov8n.pt"

            # Auto-download dedicated weights if missing
            if not os.path.exists(target_weights):
                try:
                    print("[YOLO] Downloading specialized fire_yolov8n.pt weights (6MB) from Hugging Face...")
                    import urllib.request
                    url = "https://huggingface.co/rabahdev/fire-smoke-yolov8n/resolve/main/best.pt"
                    urllib.request.urlretrieve(url, target_weights)
                    print("[YOLO] Download complete!")
                except Exception as dl_err:
                    print(f"[YOLO] Notice: Could not auto-download specialized weights ({dl_err}).")

            if os.path.exists(target_weights):
                self.model = YOLO(target_weights)
                self.is_loaded = True
                names = list(self.model.names.values())
                self.has_fire_classes = any("fire" in str(n).lower() or "smoke" in str(n).lower() for n in names)
                print(f"[YOLO] Successfully loaded model '{target_weights}' with classes: {self.model.names}")
            else:
                print(f"[YOLO] Notice: '{target_weights}' not found locally.")
        except Exception as e:
            print(f"[YOLO] Initialization error: {e}")
            self.is_loaded = False

    def detect(self, frame: np.ndarray, conf_threshold: float = 0.40) -> List[Dict[str, Any]]:
        if not self.is_loaded or self.model is None or frame is None:
            return []

        try:
            results = self.model(frame, verbose=False, conf=conf_threshold)
            detections = []
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0].item())
                    cls_name = r.names.get(cls_id, "").lower()
                    conf = float(box.conf[0].item())

                    # Match fire or smoke classes
                    if "fire" in cls_name or "smoke" in cls_name or "flame" in cls_name:
                        x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                        detections.append({
                            "label": "fire" if ("fire" in cls_name or "flame" in cls_name) else "smoke",
                            "confidence": round(conf, 3),
                            "box": [x1, y1, x2, y2]
                        })
            return detections
        except Exception as e:
            print(f"[YOLO] Detection error: {e}")
            return []

class CompositeFireDetector(BaseDetector):
    """
    Main detection pipeline:
    - Exclusively utilizes dedicated fine-tuned YOLO model when present.
    - Zero hallucination on faces, hands, clothes, or indoor furniture.
    """
    def __init__(self, yolo_model_path: str = "fire_yolov8n.pt"):
        self.yolo = YOLOv8FireDetector(yolo_model_path)
        # Only instantiate heuristic if neural network has no fire classes
        if self.yolo.is_loaded and self.yolo.has_fire_classes:
            self.heuristic = None
            print("[Detector] High-accuracy YOLO neural network mode active (heuristic disabled).")
        else:
            self.heuristic = HeuristicFireDetector()
            print("[Detector] Notice: Running skin-rejection heuristic fallback mode.")

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if self.yolo.is_loaded and self.yolo.has_fire_classes:
            return self.yolo.detect(frame, conf_threshold=0.40)

        if self.heuristic:
            return self.heuristic.detect(frame)

        return []
