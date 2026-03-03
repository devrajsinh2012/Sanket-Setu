"""
Pipeline A — XGBoost classifier on raw MediaPipe landmarks.

Input  : 63 floats  [x0,y0,z0 … x20,y20,z20]  (already [0,1] normalised by MediaPipe)
Output : PredictionResult
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import List

import numpy as np

from app.models.label_map import get_sign


@dataclass
class PredictionResult:
    sign: str
    confidence: float
    label_index: int
    probabilities: List[float]
    pipeline: str
    latency_ms: float


def predict(landmarks: List[float], xgb_model) -> PredictionResult:
    """
    Run XGBoost inference on a flat 63-element landmark vector.

    Parameters
    ----------
    landmarks : list of 63 floats
    xgb_model : loaded XGBClassifier instance

    Returns
    -------
    PredictionResult
    """
    t0 = time.perf_counter()

    X = np.array(landmarks, dtype=np.float32).reshape(1, -1)   # shape (1, 63)
    proba = xgb_model.predict_proba(X)[0]                       # shape (34,)
    idx   = int(np.argmax(proba))
    conf  = float(proba[idx])

    latency = (time.perf_counter() - t0) * 1000

    return PredictionResult(
        sign=get_sign(idx),
        confidence=conf,
        label_index=idx,
        probabilities=proba.tolist(),
        pipeline="A",
        latency_ms=latency,
    )
