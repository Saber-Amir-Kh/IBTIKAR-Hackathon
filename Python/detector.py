import os
import cv2
import numpy as np
from typing import List, Dict, Any

class BaseDetector:
    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        raise NotImplementedError

def normalize_illumination(frame: np.ndarray, mean_luma: float) -> np.ndarray:
    """
    Normalizes illumination extremes (bright chamber lights, glare, and low-light darkness).
    Operates in LAB color space to preserve genuine flame chroma (A & B channels)
    while stabilizing luminance (L channel) via adaptive CLAHE and highlight gamma correction.
    """
    if frame is None or frame.size == 0:
        return frame

    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    # Adaptive CLAHE clip limit based on ambient lighting
    if mean_luma > 130:
        clip_limit = 2.4  # Suppresses glare and restores washed-out flame edges
    elif mean_luma < 65:
        clip_limit = 1.8  # Opens up dim shadows without amplifying noise
    else:
        clip_limit = 2.0

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l_norm = clahe.apply(l)

    # Highlight gamma compression when room light is ON
    if mean_luma > 140:
        inv_gamma = 1.0 / 1.16
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype(np.uint8)
        l_norm = cv2.LUT(l_norm, table)
    elif mean_luma < 50:
        inv_gamma = 1.0 / 0.88
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype(np.uint8)
        l_norm = cv2.LUT(l_norm, table)

    merged = cv2.merge([l_norm, a, b])
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

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

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_luma = float(np.mean(gray))

        # 1. YCrCb Skin Tone Rejection Mask
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
        _, cr, cb = cv2.split(ycrcb)
        skin_mask = (cr >= 133) & (cr <= 175) & (cb >= 75) & (cb <= 127)

        # 2. HSV & RGB Flame Mask with adaptive saturation for bright room lighting
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        b, g, r = cv2.split(frame)

        min_s = 65 if mean_luma > 120 else 85
        min_v = 150 if mean_luma > 120 else 160

        lower_fire1 = np.array([0, min_s, min_v])
        upper_fire1 = np.array([35, 255, 255])
        mask1 = cv2.inRange(hsv, lower_fire1, upper_fire1)

        lower_fire2 = np.array([160, min_s, min_v])
        upper_fire2 = np.array([180, 255, 255])
        mask2 = cv2.inRange(hsv, lower_fire2, upper_fire2)

        fire_hsv = cv2.bitwise_or(mask1, mask2)

        # Flame rule: R channel prominence over G and B adapted to ambient lighting
        diff = 8 if mean_luma > 120 else 15
        flame_rgb_rule = (r > 150) & (r > (g.astype(np.int16) + diff)) & (g > b)
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
    Features dual-illumination inference to remain accurate under both high-brightness and low-light.
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

    def _run_model(self, frame: np.ndarray, conf_threshold: float) -> List[Dict[str, Any]]:
        results = self.model(frame, verbose=False, conf=conf_threshold)
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                cls_name = r.names.get(cls_id, "").lower()
                conf = float(box.conf[0].item())

                if "fire" in cls_name or "smoke" in cls_name or "flame" in cls_name:
                    x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                    detections.append({
                        "label": "fire" if ("fire" in cls_name or "flame" in cls_name) else "smoke",
                        "confidence": round(conf, 3),
                        "box": [x1, y1, x2, y2]
                    })
        return detections

    def _merge_detections(self, detsA: List[Dict[str, Any]], detsB: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merges two detection sets, choosing highest confidence for overlapping regions."""
        if not detsA:
            return detsB
        if not detsB:
            return detsA

        merged = list(detsA)
        for b_det in detsB:
            b_box = b_det["box"]
            matched = False
            for i, a_det in enumerate(merged):
                a_box = a_det["box"]
                ix1, iy1 = max(a_box[0], b_box[0]), max(a_box[1], b_box[1])
                ix2, iy2 = min(a_box[2], b_box[2]), min(a_box[3], b_box[3])
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                areaA = (a_box[2] - a_box[0]) * (a_box[3] - a_box[1])
                areaB = (b_box[2] - b_box[0]) * (b_box[3] - b_box[1])
                iou = inter / float(areaA + areaB - inter) if (areaA + areaB - inter) > 0 else 0
                io_min = inter / float(min(areaA, areaB)) if min(areaA, areaB) > 0 else 0

                if iou >= 0.20 or io_min >= 0.30:
                    matched = True
                    if b_det["confidence"] > a_det["confidence"]:
                        merged[i] = b_det
                    break

            if not matched:
                merged.append(b_det)

        merged.sort(key=lambda d: d["confidence"], reverse=True)
        return merged

    def detect(self, frame: np.ndarray, conf_threshold: float = 0.28) -> List[Dict[str, Any]]:
        if not self.is_loaded or self.model is None or frame is None:
            return []

        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            mean_luma = float(np.mean(gray))

            # Run primary inference on raw frame
            detections = self._run_model(frame, conf_threshold)

            # If chamber light is ON (mean_luma > 120) or no strong detection found:
            # Run illumination-normalized inference to recover contrast washed out by glare
            if mean_luma > 120 or (not any(d["confidence"] >= 0.65 for d in detections) and mean_luma < 70):
                norm_frame = normalize_illumination(frame, mean_luma)
                norm_dets = self._run_model(norm_frame, conf_threshold)
                detections = self._merge_detections(detections, norm_dets)

            return detections
        except Exception as e:
            print(f"[YOLO] Detection error: {e}")
            return []

class FaceRejectionFilter:
    """
    Suppresses smoke/fire detections that actually contain human skin tones.
    Works on cv2 5.0+ without any external model files.

    Strategy:
    - Convert the detection crop to YCrCb and HSV color spaces
    - Count pixels that fall within human skin-tone ranges
    - If >25% of the crop is skin-colored AND the region is in the upper half of
      frame (where a person's head/hair typically appears), reject the detection
    - Also reject "smoke" detections with a near-square/portrait aspect ratio in the
      upper portion of frame — characteristic of a face or head region
    """

    # YCrCb skin ranges (standard face detector range)
    YCRCB_CR_MIN, YCRCB_CR_MAX = 133, 173
    YCRCB_CB_MIN, YCRCB_CB_MAX = 77,  127

    # HSV skin ranges (for olive/brown/tanned skin and hair highlights)
    HSV_LOWER = np.array([0,   20, 70],  dtype=np.uint8)
    HSV_UPPER = np.array([25, 255, 255], dtype=np.uint8)
    HSV_LOWER2 = np.array([165, 20, 70],  dtype=np.uint8)
    HSV_UPPER2 = np.array([180, 255, 255], dtype=np.uint8)

    def __init__(self):
        print("[FaceFilter] Skin-tone face rejection filter ACTIVE (cv2 5.0 compatible).")

    def _skin_pixel_ratio(self, crop: np.ndarray) -> float:
        """Return fraction of pixels in crop that match skin-tone in YCrCb + HSV."""
        if crop is None or crop.size == 0:
            return 0.0
        h, w = crop.shape[:2]
        total = max(1, h * w)

        # YCrCb mask
        ycrcb = cv2.cvtColor(crop, cv2.COLOR_BGR2YCrCb)
        cr = ycrcb[:, :, 1]
        cb = ycrcb[:, :, 2]
        skin_ycrcb = (
            (cr >= self.YCRCB_CR_MIN) & (cr <= self.YCRCB_CR_MAX) &
            (cb >= self.YCRCB_CB_MIN) & (cb <= self.YCRCB_CB_MAX)
        )

        # HSV mask (catches warm skin highlights)
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        mask_h1 = cv2.inRange(hsv, self.HSV_LOWER, self.HSV_UPPER)
        mask_h2 = cv2.inRange(hsv, self.HSV_LOWER2, self.HSV_UPPER2)
        skin_hsv = (mask_h1 | mask_h2).astype(bool)

        combined = skin_ycrcb | skin_hsv
        return float(np.sum(combined)) / total

    def is_likely_face_region(self, det_box: list, frame: np.ndarray, label: str) -> bool:
        """
        Returns True if this detection is likely a false positive on a human face/head.
        Uses multiple criteria:
        1. High skin-pixel ratio in the crop
        2. Crop is in the upper 60% of the frame (head position)
        3. Near-square or portrait-shaped bounding box (face shape)
        4. Label is 'smoke' (not 'fire' — real fire rarely produces skin tones)
        """
        if frame is None:
            return False
        x1, y1, x2, y2 = [int(v) for v in det_box]
        frame_h, frame_w = frame.shape[:2]

        # Only check "smoke" — fire has distinctive orange/red chrominance
        if label.lower() != "smoke":
            return False

        # Only filter in upper 70% of the frame — head/body area
        box_center_y = (y1 + y2) / 2.0
        if box_center_y > frame_h * 0.70:
            return False

        # Crop the detection region (clamp to frame bounds)
        cx1 = max(0, x1)
        cy1 = max(0, y1)
        cx2 = min(frame_w, x2)
        cy2 = min(frame_h, y2)
        crop = frame[cy1:cy2, cx1:cx2]
        if crop.size == 0:
            return False

        # Check skin pixel ratio
        skin_ratio = self._skin_pixel_ratio(crop)
        if skin_ratio >= 0.22:
            return True

        # Secondary check: near-square bounding box in upper frame at moderate skin ratio
        # (face/head can have hair reducing skin ratio but box is still portrait)
        box_w = x2 - x1
        box_h = y2 - y1
        aspect = box_h / max(1, box_w)  # portrait = > 0.8
        if 0.7 <= aspect <= 2.5 and skin_ratio >= 0.12 and box_center_y < frame_h * 0.45:
            return True

        return False

    def filter(self, detections: list, frame: np.ndarray) -> list:
        """Remove detections likely matching a human face/head region."""
        if not detections or frame is None:
            return detections
        kept = []
        for det in detections:
            if self.is_likely_face_region(det["box"], frame, det.get("label", "")):
                print(f"[FaceFilter] Suppressed {det['label']} ({det['confidence']*100:.0f}%) — skin-tone overlap detected.")
            else:
                kept.append(det)
        return kept


class CompositeFireDetector(BaseDetector):
    """
    Main detection pipeline:
    - Exclusively utilizes dedicated fine-tuned YOLO model when present.
    - Applies face rejection filter to suppress false positives on human faces/hair.
    """
    def __init__(self, yolo_model_path: str = "fire_yolov8n.pt"):
        self.yolo = YOLOv8FireDetector(yolo_model_path)
        self.face_filter = FaceRejectionFilter()
        # Only instantiate heuristic if neural network has no fire classes
        if self.yolo.is_loaded and self.yolo.has_fire_classes:
            self.heuristic = None
            print("[Detector] High-accuracy YOLO neural network mode active (heuristic disabled).")
        else:
            self.heuristic = HeuristicFireDetector()
            print("[Detector] Notice: Running skin-rejection heuristic fallback mode.")

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if self.yolo.is_loaded and self.yolo.has_fire_classes:
            raw = self.yolo.detect(frame, conf_threshold=0.28)
            return self.face_filter.filter(raw, frame)

        if self.heuristic:
            raw = self.heuristic.detect(frame)
            return self.face_filter.filter(raw, frame)

        return []
