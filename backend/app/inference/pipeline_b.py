"""
Pipeline B — Autoencoder encoder + LightGBM classifier.

Input  : 63 floats  [x0,y0,z0 … x20,y20,z20]
Process: Keras encoder compresses to 16-D bottleneck → LGBMClassifier
Output : PredictionResult
"""
from __future__ import annotations

import time
import warnings
from dataclasses import dataclass
from typing import List, Any

import numpy as np

from app.models.label_map import get_sign
from app.inference.pipeline_a import PredictionResult


def predict(landmarks: List[float], encoder_model: Any, lgbm_model: Any) -> PredictionResult:
    """
    Run the autoencoder-encoder → LightGBM inference chain.

    Parameters
    ----------
    landmarks     : list of 63 floats
    encoder_model : Keras Model (input 63→output 16, bottleneck sub-model)
    lgbm_model    : loaded LGBMClassifier instance

    Returns
    -------
    PredictionResult
    """
    t0 = time.perf_counter()

    X = np.array(landmarks, dtype=np.float32).reshape(1, -1)   # (1, 63)

    # Encode to 16-D bottleneck (suppress verbose Keras progress bar)
    features = encoder_model(X, training=False).numpy()         # (1, 16)

    # LightGBM classify — suppress sklearn feature-name warning (model was
    # fitted with a named DataFrame; numpy array input is perfectly valid)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        proba = lgbm_model.predict_proba(features)[0]           # (34,)
    idx   = int(np.argmax(proba))
    conf  = float(proba[idx])

    latency = (time.perf_counter() - t0) * 1000

    return PredictionResult(
        sign=get_sign(idx),
        confidence=conf,
        label_index=idx,
        probabilities=proba.tolist(),
        pipeline="B",
        latency_ms=latency,
    )
