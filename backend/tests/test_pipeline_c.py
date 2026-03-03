"""
tests/test_pipeline_c.py — ResNet50 CNN feature extractor + SVM inference.
"""
from __future__ import annotations

import base64
import io

import numpy as np
import pytest

from app.inference.pipeline_c import predict


# ---------------------------------------------------------------------------
# Helpers — build dummy images
# ---------------------------------------------------------------------------

def _black_128_b64() -> str:
    """128×128 black image as base64-encoded JPEG."""
    from PIL import Image
    img = Image.fromarray(np.zeros((128, 128, 3), dtype=np.uint8), mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


def _noise_128_b64() -> str:
    """128×128 random-noise image as base64-encoded JPEG."""
    from PIL import Image
    rng = np.random.default_rng(42)
    arr = rng.integers(0, 255, (128, 128, 3), dtype=np.uint8)
    img = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPipelineC:

    def test_predict_black_image(self, cnn_model, svm_model):
        result = predict(_black_128_b64(), cnn_model, svm_model)
        assert result.sign is not None
        assert 0.0 <= result.confidence <= 1.0
        assert 0 <= result.label_index <= 33
        assert result.pipeline == "C"
        assert result.latency_ms > 0

    def test_predict_noise_image(self, cnn_model, svm_model):
        result = predict(_noise_128_b64(), cnn_model, svm_model)
        assert 0.0 <= result.confidence <= 1.0

    def test_probabilities_sum_to_one(self, cnn_model, svm_model):
        result = predict(_noise_128_b64(), cnn_model, svm_model)
        assert result.probabilities is not None
        total = sum(result.probabilities)
        assert abs(total - 1.0) < 1e-4, f"Probabilities sum to {total}"

    def test_probabilities_length(self, cnn_model, svm_model):
        result = predict(_black_128_b64(), cnn_model, svm_model)
        assert len(result.probabilities) == 34

    def test_cnn_feature_shape(self, cnn_model):
        """CNN feature extractor must output 256-D vector."""
        inp = np.zeros((1, 128, 128, 3), dtype="float32")
        out = cnn_model(inp, training=False).numpy()
        assert out.shape == (1, 256), f"Unexpected CNN output shape: {out.shape}"

    def test_invalid_b64_raises(self, cnn_model, svm_model):
        with pytest.raises(Exception):
            predict("not-valid-base64!!", cnn_model, svm_model)

    def test_wrong_size_image_is_resized(self, cnn_model, svm_model):
        """A 64×64 image should be auto-resized to 128×128 without error."""
        from PIL import Image
        img = Image.fromarray(np.zeros((64, 64, 3), dtype=np.uint8), mode="RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        result = predict(b64, cnn_model, svm_model)
        assert 0.0 <= result.confidence <= 1.0
