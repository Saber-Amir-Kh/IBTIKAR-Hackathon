import os
import cv2
import numpy as np
from typing import List, Dict, Any

class BaseDetector:
    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        raise NotImplementedError

class HeuristicFireDetector(BaseDetector):
    """
    High-sensitivity color-space and morphology fire & smoke detector.
    Detects real flame (lighter, candle, wildfire) and phone screen fire videos:
    - Flame hue in HSV: [0, 32] (red/orange/yellow) and [160, 180] (crimson)
    - High red channel dominance (R > 130, R > G, G >= B)
    - Contoured bounding boxes with minimum pixel threshold
    """
    def __init__(self, min_area: int = 40):
        self.min_area = min_area

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if frame is None or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        detections = []

        # Convert to HSV
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        b, g, r = cv2.split(frame)

        # 1. Fire Mask (Flame hues + RGB threshold)
        lower_fire1 = np.array([0, 70, 130])
        upper_fire1 = np.array([32, 255, 255])
        mask1 = cv2.inRange(hsv, lower_fire1, upper_fire1)

        lower_fire2 = np.array([160, 70, 130])
        upper_fire2 = np.array([180, 255, 255])
        mask2 = cv2.inRange(hsv, lower_fire2, upper_fire2)

        fire_hsv = cv2.bitwise_or(mask1, mask2)

        # RGB dominance rule for fire: Red is dominant channel, bright intensity
        rgb_rule = (r > 130) & (r > g) & (g >= (b * 0.85).astype(np.uint8))
        fire_mask = cv2.bitwise_and(fire_hsv, fire_hsv, mask=rgb_rule.astype(np.uint8) * 255)

        # Morphological clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fire_mask = cv2.morphologyEx(fire_mask, cv2.MORPH_OPEN, kernel)
        fire_mask = cv2.dilate(fire_mask, kernel, iterations=2)

        contours, _ = cv2.findContours(fire_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area >= self.min_area:
                x, y, bw, bh = cv2.boundingRect(cnt)
                # Expand box slightly for clear visualization
                pad = 10
                x1 = max(0, x - pad)
                y1 = max(0, y - pad)
                x2 = min(w, x + bw + pad)
                y2 = min(h, y + bh + pad)

                # Confidence based on area and pixel intensity
                confidence = float(min(0.97, 0.78 + min(0.18, (area / 4000.0) * 0.15)))
                detections.append({
                    "label": "fire",
                    "confidence": round(confidence, 3),
                    "box": [x1, y1, x2, y2],
                    "area": area
                })

        # 2. Smoke Mask (Greyish low saturation, mid-high brightness)
        lower_smoke = np.array([0, 0, 100])
        upper_smoke = np.array([180, 45, 220])
        smoke_mask = cv2.inRange(hsv, lower_smoke, upper_smoke)
        smoke_mask = cv2.morphologyEx(smoke_mask, cv2.MORPH_OPEN, kernel)
        smoke_contours, _ = cv2.findContours(smoke_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in smoke_contours:
            area = cv2.contourArea(cnt)
            if area >= self.min_area * 5: # Smoke plumes are larger
                x, y, bw, bh = cv2.boundingRect(cnt)
                if y > h * 0.10: # avoid pure ceiling/sky
                    x1 = max(0, x - 10)
                    y1 = max(0, y - 10)
                    x2 = min(w, x + bw + 10)
                    y2 = min(h, y + bh + 10)

                    confidence = float(min(0.88, 0.75 + min(0.12, (area / 15000.0) * 0.10)))
                    detections.append({
                        "label": "smoke",
                        "confidence": round(confidence, 3),
                        "box": [x1, y1, x2, y2],
                        "area": area
                    })

        # Sort by confidence descending
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections

class YOLOv8FireDetector(BaseDetector):
    def __init__(self, model_path: str = "yolov8n.pt"):
        self.model = None
        self.is_loaded = False
        try:
            from ultralytics import YOLO
            weights = model_path if os.path.exists(model_path) else "yolov8n.pt"
            self.model = YOLO(weights)
            self.is_loaded = True
            print(f"[YOLO] Initialized model: {weights}")
        except Exception as e:
            print(f"[YOLO] Notice: Running heuristic detector ({e})")
            self.is_loaded = False

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if not self.is_loaded or self.model is None or frame is None:
            return []

        try:
            results = self.model(frame, verbose=False, conf=0.45)
            detections = []
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0].item())
                    cls_name = r.names.get(cls_id, "").lower()
                    conf = float(box.conf[0].item())

                    if "fire" in cls_name or "smoke" in cls_name:
                        x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                        detections.append({
                            "label": "fire" if "fire" in cls_name else "smoke",
                            "confidence": round(conf, 3),
                            "box": [x1, y1, x2, y2]
                        })
            return detections
        except Exception:
            return []

class CompositeFireDetector(BaseDetector):
    def __init__(self, yolo_model_path: str = "yolov8n.pt"):
        self.yolo = YOLOv8FireDetector(yolo_model_path)
        self.heuristic = HeuristicFireDetector()

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        # 1. Try YOLO first
        results = self.yolo.detect(frame)
        if results:
            return results

        # 2. High-precision color/morphology detector
        return self.heuristic.detect(frame)
