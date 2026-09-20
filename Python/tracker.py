import time
import math
from typing import List, Dict, Any, Optional

def compute_box_overlap(boxA: List[int], boxB: List[int]) -> float:
    """
    Computes spatial overlap between two bounding boxes [x1, y1, x2, y2].
    Combines Intersection over Union (IoU), Intersection over Min Area (IoMin),
    and center distance to reliably connect flickering flames in the same area.
    """
    x1a, y1a, x2a, y2a = boxA
    x1b, y1b, x2b, y2b = boxB

    ix1 = max(x1a, x1b)
    iy1 = max(y1a, y1b)
    ix2 = min(x2a, x2b)
    iy2 = min(y2a, y2b)

    inter_w = max(0, ix2 - ix1)
    inter_h = max(0, iy2 - iy1)
    inter_area = inter_w * inter_h

    areaA = max(1, (x2a - x1a) * (y2a - y1a))
    areaB = max(1, (x2b - x1b) * (y2b - y1b))
    union_area = areaA + areaB - inter_area

    iou = inter_area / union_area if union_area > 0 else 0.0
    io_min = inter_area / min(areaA, areaB) if min(areaA, areaB) > 0 else 0.0

    # Center distance comparison
    cxA = (x1a + x2a) / 2.0
    cyA = (y1a + y2a) / 2.0
    cxB = (x1b + x2b) / 2.0
    cyB = (y1b + y2b) / 2.0
    center_dist = math.hypot(cxA - cxB, cyA - cyB)
    diagA = math.hypot(x2a - x1a, y2a - y1a)
    diagB = math.hypot(x2b - x1b, y2b - y1b)
    max_diag = max(diagA, diagB, 50.0)

    # Bounding boxes belong to the same area if:
    # 1. IoU >= 15%, OR
    # 2. IoMin >= 25% (one box is inside or largely overlapping the other), OR
    # 3. They intersect and centers are within 80% of diagonal, OR
    # 4. Centers are within 65% of diagonal (slight camera wobble)
    is_overlapping = (
        iou >= 0.15 or
        io_min >= 0.25 or
        (inter_area > 0 and center_dist <= max_diag * 0.8) or
        (center_dist <= max_diag * 0.65)
    )

    if not is_overlapping:
        return 0.0

    # Combined score prioritizing overlap
    score = max(iou, io_min * 0.8, max(0.0, 1.0 - (center_dist / max_diag)))
    return score

class TrackedFireArea:
    def __init__(self, track_id: int, box: List[int], label: str, confidence: float, now: float):
        self.track_id = track_id
        self.box = list(box)
        self.label = label
        self.confidence = confidence
        self.first_seen = now
        self.last_seen = now
        self.sustained_duration = 0.0
        self.in_memory_hold = False
        self.memory_duration = 0.0
        self.triggered = False

    def update(self, box: List[int], label: str, confidence: float, now: float):
        # Smooth spatial box update to prevent jitter
        alpha = 0.35
        self.box = [
            int((1 - alpha) * self.box[0] + alpha * box[0]),
            int((1 - alpha) * self.box[1] + alpha * box[1]),
            int((1 - alpha) * self.box[2] + alpha * box[2]),
            int((1 - alpha) * self.box[3] + alpha * box[3]),
        ]
        self.label = label
        self.confidence = max(self.confidence * 0.4 + confidence * 0.6, confidence)
        self.last_seen = now
        self.in_memory_hold = False
        self.memory_duration = 0.0
        self.sustained_duration = now - self.first_seen

    def tick_memory(self, now: float, memory_grace_sec: float) -> bool:
        """
        Retains the fire area in memory during temporary stutter or frame drops.
        Returns True if the area is still retained in memory, False if expired.
        """
        elapsed_since_seen = now - self.last_seen
        if elapsed_since_seen <= memory_grace_sec:
            self.in_memory_hold = True
            self.memory_duration = elapsed_since_seen
            # Continue the sustained countdown without resetting!
            self.sustained_duration = now - self.first_seen
            return True
        else:
            return False

class SpatialFireTracker:
    """
    Spatially-aware fire tracker with temporal memory and bounding-box overlap association.
    Maintains continuity of sustained fire detection across video stutters, flame flickers,
    and camera frame drops for a designated memory window (default: 0.8-1.0s).
    """
    def __init__(self, sustained_seconds: float = 2.0, memory_grace_seconds: float = 0.8, confidence_threshold: float = 0.70):
        self.sustained_seconds = sustained_seconds
        self.memory_grace_seconds = memory_grace_seconds
        self.confidence_threshold = confidence_threshold
        self.current_effective_threshold = confidence_threshold
        self.current_mean_luma = 80.0
        self.tracks: Dict[int, TrackedFireArea] = {}
        self.next_track_id = 1

    def get_dynamic_threshold(self, mean_luma: Optional[float] = None) -> float:
        """
        Calculates dynamic confidence threshold based on ambient chamber lighting.
        When room/chamber lights are turned ON (mean_luma > 105), camera exposure washes out
        flame highlights and reduces contrast, lowering raw YOLO confidence slightly.
        Dynamically scaling threshold from 0.70 down to ~0.58-0.62 prevents false negatives
        while keeping strict suppression of false positives.
        """
        if mean_luma is None:
            return self.confidence_threshold

        if mean_luma >= 125.0:
            # High brightness / Chamber light ON: scale down to 0.58
            return round(max(0.58, self.confidence_threshold - 0.12), 2)
        elif mean_luma > 100.0:
            # Transition region: interpolate smoothly between 0.70 and 0.60
            ratio = (mean_luma - 100.0) / 25.0
            eff = self.confidence_threshold - (0.10 * ratio)
            return round(max(0.60, eff), 2)
        else:
            # Normal or low-light: maintain standard high confidence
            return self.confidence_threshold

    def update(self, detections: List[Dict[str, Any]], now: Optional[float] = None, mean_luma: Optional[float] = None) -> List[TrackedFireArea]:
        if now is None:
            now = time.time()

        if mean_luma is not None:
            self.current_mean_luma = mean_luma

        effective_thresh = self.get_dynamic_threshold(mean_luma)
        self.current_effective_threshold = effective_thresh

        # Continuity threshold for sustaining existing active tracks (even through lighting dips)
        continuity_thresh = max(0.48, effective_thresh - 0.10)

        # Qualifying detections for new tracks (confidence >= effective_thresh)
        # or for continuing existing tracks (confidence >= continuity_thresh)
        candidate_dets = [d for d in detections if d.get("confidence", 0) >= continuity_thresh]

        matched_track_ids = set()
        unmatched_dets = []

        # Associate detections with existing tracks based on maximum spatial overlap
        for det in candidate_dets:
            best_track_id = None
            best_score = 0.0
            box = det["box"]

            for tid, track in self.tracks.items():
                if tid in matched_track_ids:
                    continue
                score = compute_box_overlap(box, track.box)
                if score > 0.0 and score > best_score:
                    best_score = score
                    best_track_id = tid

            if best_track_id is not None:
                self.tracks[best_track_id].update(box, det["label"], det["confidence"], now)
                matched_track_ids.add(best_track_id)
            else:
                # For spawning NEW tracks, enforce the full effective_thresh
                if det.get("confidence", 0) >= effective_thresh:
                    unmatched_dets.append(det)

        # For existing tracks that were not matched this frame:
        # Check if they are still within the memory grace period
        expired_ids = []
        for tid, track in self.tracks.items():
            if tid not in matched_track_ids:
                retained = track.tick_memory(now, self.memory_grace_seconds)
                if not retained:
                    expired_ids.append(tid)

        for tid in expired_ids:
            del self.tracks[tid]

        # For unmatched detections, spawn new tracked areas
        for det in unmatched_dets:
            tid = self.next_track_id
            self.next_track_id += 1
            self.tracks[tid] = TrackedFireArea(tid, det["box"], det["label"], det["confidence"], now)

        return list(self.tracks.values())

    def get_highest_sustained_area(self) -> Optional[TrackedFireArea]:
        if not self.tracks:
            return None
        return max(self.tracks.values(), key=lambda t: t.sustained_duration)

    def get_ready_to_trigger_areas(self, cooldown_active: bool) -> List[TrackedFireArea]:
        if cooldown_active:
            return []
        ready = []
        for track in self.tracks.values():
            if track.sustained_duration >= self.sustained_seconds and not track.triggered:
                ready.append(track)
        return ready
