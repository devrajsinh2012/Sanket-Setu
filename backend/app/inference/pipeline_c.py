"""
Pipeline C — Pre-trained CNN (ResNet50) feature extractor + SVM classifier.

Input  : base-64 encoded JPEG string OR raw bytes of a 128×128 RGB hand-crop.
Process: Decode → normalise → CNN (256-D features) → SVC.predict_proba
Output : PredictionResult

Note: This pipeline is significantly slower (~100–300 ms on CPU) and is only
invoked as a fallback when landmark-based pipelines have low confidence.
"""
from __future__ import annotations

import base64
import io
import time
from dataclasses import dataclass
from typing import Any, List, Union

import numpy as np
from PIL import Image

from app.models.label_map import get_sign
from app.inference.pipeline_a import PredictionResult

# Target input size expected by the CNN (ResNet50 Functional model)
CNN_IMG_SIZE: int = 128


def _decode_image(image_input: Union[str, bytes]) -> np.ndarray:
    """
    Accept either:
      - A base-64 encoded JPEG string  (from WebSocket JSON payload)
      - Raw bytes                       (from HTTP multipart)
    Returns a (128, 128, 3) float32 array normalised to [0, 1].
    """
    if isinstance(image_input, str):
        raw = base64.b64decode(image_input)
    else:
        raw = image_input

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img = img.resize((CNN_IMG_SIZE, CNN_IMG_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return arr   # (128, 128, 3)


def predict(
    image_input: Union[str, bytes],
    cnn_model: Any,
    svm_model: Any,
) -> PredictionResult:
    """
    Run the CNN + SVM inference pipeline.

    Parameters
    ----------
    image_input : base-64 JPEG string or raw bytes of the hand crop (any size; will be resized)
    cnn_model   : Keras Functional model (ResNet50-based, output 256-D feature vector)
    svm_model   : loaded SVC(C=10, probability=True) instance

    Returns
    -------
    PredictionResult
    """
    t0 = time.perf_counter()

    img = _decode_image(image_input)           # (128, 128, 3)
    batch = img[np.newaxis]                    # (1, 128, 128, 3)

    # CNN forward pass — directly call model (avoids Keras verbose logging)
    features = cnn_model(batch, training=False).numpy()   # (1, 256)

    proba = svm_model.predict_proba(features)[0]          # (34,)
    idx   = int(np.argmax(proba))
    conf  = float(proba[idx])

    latency = (time.perf_counter() - t0) * 1000

    return PredictionResult(
        sign=get_sign(idx),
        confidence=conf,
        label_index=idx,
        probabilities=proba.tolist(),
        pipeline="C",
        latency_ms=latency,
    )
