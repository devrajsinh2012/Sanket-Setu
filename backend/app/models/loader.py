"""
Singleton model store — loads all model artifacts once at startup and holds them
in memory for the lifetime of the process.

Usage inside FastAPI:
    from app.models.loader import get_model_store
    store = get_model_store()          # dependency injection or direct call
"""
from __future__ import annotations

import logging
import os
import pickle
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data class that holds every loaded artifact
# ---------------------------------------------------------------------------

@dataclass
class ModelStore:
    # Pipeline A
    xgb_model: Any = field(default=None)

    # Pipeline B
    encoder_model: Any = field(default=None)   # Keras sub-model (encoder half)
    lgbm_model: Any = field(default=None)

    # Pipeline C
    cnn_model: Any = field(default=None)        # Keras ResNet50 feature extractor
    svm_model: Any = field(default=None)

    loaded: bool = field(default=False)


# Module-level singleton
_store: ModelStore | None = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _load_pickle(path: str, label: str) -> Any:
    t0 = time.perf_counter()
    with open(path, "rb") as f:
        obj = pickle.load(f)
    elapsed = (time.perf_counter() - t0) * 1000
    logger.info("Loaded %-35s  (%.1f ms)", label, elapsed)
    return obj


def _build_encoder(autoencoder_pkl_path: str) -> Any:
    """
    Load the full autoencoder from pickle and extract the encoder sub-model.
    The autoencoder is a Keras Sequential:
        InputLayer  (63)
        Dense 32 relu      ← layer index 0
        Dense 16 relu      ← layer index 1  ← bottleneck output
        Dense 32 relu
        Dense 63 linear
    We build a Keras Model that maps input → output of the bottleneck Dense.
    """
    import os
    os.environ.setdefault("KERAS_BACKEND", "tensorflow")
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

    full_ae = _load_pickle(autoencoder_pkl_path, "autoencoder_model.pkl")

    # Dynamically import keras after env vars are set
    import keras

    # The Sequential model's built layers: 0=Dense(32), 1=Dense(16), 2=Dense(32), 3=Dense(63)
    # layer index 1 output is the 16-D bottleneck.
    # We can't use full_ae.input directly on a Sequential that was pickled without
    # a traced input tensor, so we wire the layers manually.
    import numpy as _np
    inp = keras.Input(shape=(63,), name="encoder_input")
    x = full_ae.layers[0](inp)   # Dense(32, relu)
    x = full_ae.layers[1](x)     # Dense(16, relu) — bottleneck
    encoder = keras.Model(inputs=inp, outputs=x, name="encoder_only")
    logger.info("Built encoder sub-model: input(%s) → output(%s)", encoder.input_shape, encoder.output_shape)
    return encoder


def _build_cnn_feature_extractor(cnn_pkl_path: str) -> Any:
    """
    Load the full CNN (ResNet50 Functional model) from pickle and return a
    sub-model that outputs the 256-D penultimate Dense layer.

    Architecture (tail of the model):
        … ResNet50 backbone …
        GlobalAveragePooling2D
        Dropout(0.5)
        Dense(256, relu)       ← feature vector we want
        Dropout(0.5)
        Dense(34, softmax)     ← final classification head (skip this)

    The SVC was trained on the 256-D features, so we must stop before the
    final Dense(34) layer.
    """
    import os
    os.environ.setdefault("KERAS_BACKEND", "tensorflow")
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

    import keras

    full_cnn = _load_pickle(cnn_pkl_path, "cnn_model.pkl")

    # Find the Dense(256) layer by scanning from the end
    feature_layer = None
    for layer in reversed(full_cnn.layers):
        cfg = layer.get_config()
        if layer.__class__.__name__ == 'Dense' and cfg.get('units') == 256:
            feature_layer = layer
            break

    if feature_layer is None:
        logger.warning(
            "Could not find Dense(256) layer; using full CNN output as features."
        )
        return full_cnn

    extractor = keras.Model(
        inputs=full_cnn.input,
        outputs=feature_layer.output,
        name="cnn_feature_extractor",
    )
    logger.info(
        "CNN feature extractor: input %s → output %s",
        extractor.input_shape,
        extractor.output_shape,
    )
    return extractor


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_models() -> ModelStore:
    """
    Load all models and return a populated ModelStore.
    Call this once from the FastAPI lifespan event.
    """
    global _store

    from app import config  # local import to avoid circular at module level

    store = ModelStore()

    # ---- Pipeline A --------------------------------------------------------
    if os.path.exists(config.PIPELINE_A_MODEL):
        store.xgb_model = _load_pickle(config.PIPELINE_A_MODEL, "xgb model.pkl")
    else:
        logger.warning("Pipeline A model not found: %s", config.PIPELINE_A_MODEL)

    # ---- Pipeline B --------------------------------------------------------
    if os.path.exists(config.PIPELINE_B_AE) and os.path.exists(config.PIPELINE_B_LGBM):
        store.encoder_model = _build_encoder(config.PIPELINE_B_AE)
        store.lgbm_model    = _load_pickle(config.PIPELINE_B_LGBM, "lgbm_model.pkl")
    else:
        logger.warning("Pipeline B models not found — B will be skipped.")

    # ---- Pipeline C --------------------------------------------------------
    if os.path.exists(config.PIPELINE_C_CNN) and os.path.exists(config.PIPELINE_C_SVM):
        store.cnn_model = _build_cnn_feature_extractor(config.PIPELINE_C_CNN)
        store.svm_model = _load_pickle(config.PIPELINE_C_SVM, "svm_model.pkl")
    else:
        logger.warning("Pipeline C models not found — C will be skipped.")

    store.loaded = True
    logger.info("All models loaded successfully.")
    _store = store
    return store


def get_model_store() -> ModelStore:
    """Return the singleton ModelStore (must have been loaded via load_models() first)."""
    if _store is None or not _store.loaded:
        raise RuntimeError("ModelStore has not been initialised — call load_models() first.")
    return _store
