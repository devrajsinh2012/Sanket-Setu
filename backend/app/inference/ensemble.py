"""
Ensemble logic — orchestrates Pipelines A → B → C with confidence-based fallback.

Strategy
--------
1. Always run Pipeline A (XGBoost, sub-ms).
2. If confidence < CONFIDENCE_THRESHOLD, also run Pipeline B (Autoencoder+LGBM).
3. Average the probability vectors from the pipelines that were run.
4. If ensemble confidence still < SECONDARY_THRESHOLD AND image data is supplied,
   also run Pipeline C (CNN+SVM) and include it in the average.
5. Return the class with the highest averaged probability.

The caller can also force a specific pipeline via the PIPELINE_MODE config.
"""
from __future__ import annotations

import logging
import time
from typing import List, Optional, Any

import numpy as np

from app import config
from app.models.label_map import get_sign
from app.inference.pipeline_a import PredictionResult
import app.inference.pipeline_a as _pa
import app.inference.pipeline_b as _pb
import app.inference.pipeline_c as _pc

logger = logging.getLogger(__name__)


def run(
    landmarks: List[float],
    *,
    image_input: Optional[str] = None,
    xgb_model: Any,
    encoder_model: Any,
    lgbm_model: Any,
    cnn_model: Any,
    svm_model: Any,
    pipeline_mode: str = "ensemble",
    confidence_threshold: float = 0.70,
    secondary_threshold: float = 0.60,
) -> PredictionResult:
    """
    Run one or more inference pipelines and return a consolidated PredictionResult.

    Parameters
    ----------
    landmarks            : flat 63-element MediaPipe landmark vector
    image_input          : optional base-64 JPEG for Pipeline C
    xgb_model            : Pipeline A model
    encoder_model        : Pipeline B encoder (Keras sub-model)
    lgbm_model           : Pipeline B classifier
    cnn_model            : Pipeline C feature extractor
    svm_model            : Pipeline C classifier
    pipeline_mode        : "A" | "B" | "C" | "ensemble"
    confidence_threshold : fallback to B when A confidence < this value
    secondary_threshold  : fallback to C when ensemble(A+B) confidence < this value
    """
    t0 = time.perf_counter()

    # -----------------------------------------------------------
    # Forced single-pipeline modes
    # -----------------------------------------------------------
    if pipeline_mode == "A":
        if xgb_model is None:
            raise RuntimeError("Pipeline A model not loaded.")
        return _pa.predict(landmarks, xgb_model)

    if pipeline_mode == "B":
        if encoder_model is None or lgbm_model is None:
            raise RuntimeError("Pipeline B models not loaded.")
        return _pb.predict(landmarks, encoder_model, lgbm_model)

    if pipeline_mode == "C":
        if cnn_model is None or svm_model is None:
            raise RuntimeError("Pipeline C models not loaded.")
        if image_input is None:
            raise ValueError("Pipeline C requires image_input.")
        return _pc.predict(image_input, cnn_model, svm_model)

    # -----------------------------------------------------------
    # Ensemble mode (default)
    # -----------------------------------------------------------
    results: list[PredictionResult] = []
    proba_stack: list[list[float]] = []

    # Step 1 — Pipeline A (always)
    if xgb_model is not None:
        res_a = _pa.predict(landmarks, xgb_model)
        results.append(res_a)
        proba_stack.append(res_a.probabilities)
    else:
        logger.warning("Pipeline A not available in ensemble mode.")
        res_a = None

    # Step 2 — Pipeline B if A confidence is low
    current_conf = float(np.max(np.mean(proba_stack, axis=0))) if proba_stack else 0.0
    if current_conf < confidence_threshold and encoder_model is not None and lgbm_model is not None:
        res_b = _pb.predict(landmarks, encoder_model, lgbm_model)
        results.append(res_b)
        proba_stack.append(res_b.probabilities)

    # Step 3 — Pipeline C if still low and image provided
    current_conf = float(np.max(np.mean(proba_stack, axis=0))) if proba_stack else 0.0
    if (
        current_conf < secondary_threshold
        and image_input is not None
        and cnn_model is not None
        and svm_model is not None
    ):
        res_c = _pc.predict(image_input, cnn_model, svm_model)
        results.append(res_c)
        proba_stack.append(res_c.probabilities)

    # -----------------------------------------------------------
    # Aggregate
    # -----------------------------------------------------------
    if not proba_stack:
        raise RuntimeError("No inference pipeline could be executed.")

    avg_proba = np.mean(proba_stack, axis=0)   # shape (34,)
    idx  = int(np.argmax(avg_proba))
    conf = float(avg_proba[idx])

    pipeline_labels = "+".join(r.pipeline for r in results)
    total_latency   = (time.perf_counter() - t0) * 1000

    return PredictionResult(
        sign=get_sign(idx),
        confidence=conf,
        label_index=idx,
        probabilities=avg_proba.tolist(),
        pipeline=pipeline_labels if len(results) > 1 else results[0].pipeline,
        latency_ms=total_latency,
    )
