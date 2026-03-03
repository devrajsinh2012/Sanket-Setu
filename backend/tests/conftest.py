"""
conftest.py — shared pytest fixtures for SanketSetu backend tests.

All model fixtures use session scope so the (slow) models are loaded only once
per pytest run.  Tests that need models are automatically skipped when the
pickle files are not found (CI without model artifacts).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Make sure `app.*` imports resolve correctly when tests run from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Set env vars before any TF/Keras import
os.environ.setdefault("KERAS_BACKEND",        "tensorflow")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS","0")

from app import config                               # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _skip_if_missing(path: str, name: str):
    if not Path(path).exists():
        pytest.skip(f"Model file not found: {path}  ({name} skipped)")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def xgb_model():
    _skip_if_missing(config.PIPELINE_A_MODEL, "xgb")
    import pickle
    with open(config.PIPELINE_A_MODEL, "rb") as f:
        return pickle.load(f)


@pytest.fixture(scope="session")
def encoder_model():
    _skip_if_missing(config.PIPELINE_B_AE, "autoencoder")
    from app.models.loader import _build_encoder       # access internal helper
    return _build_encoder(config.PIPELINE_B_AE)


@pytest.fixture(scope="session")
def lgbm_model():
    _skip_if_missing(config.PIPELINE_B_LGBM, "lgbm")
    import pickle
    with open(config.PIPELINE_B_LGBM, "rb") as f:
        return pickle.load(f)


@pytest.fixture(scope="session")
def cnn_model():
    _skip_if_missing(config.PIPELINE_C_CNN, "cnn")
    from app.models.loader import _build_cnn_feature_extractor
    return _build_cnn_feature_extractor(config.PIPELINE_C_CNN)


@pytest.fixture(scope="session")
def svm_model():
    _skip_if_missing(config.PIPELINE_C_SVM, "svm")
    import pickle
    with open(config.PIPELINE_C_SVM, "rb") as f:
        return pickle.load(f)
