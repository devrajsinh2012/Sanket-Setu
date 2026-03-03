"""
tests/test_pipeline_b.py — Autoencoder encoder + LightGBM inference.
"""
from __future__ import annotations

import pytest
from app.inference.pipeline_b import predict


ZEROS_63 = [0.0] * 63
RAND_63  = [float(i % 11) / 10.0 for i in range(63)]


class TestPipelineB:

    def test_predict_zeros(self, encoder_model, lgbm_model):
        result = predict(ZEROS_63, encoder_model, lgbm_model)
        assert result.sign is not None
        assert 0.0 <= result.confidence <= 1.0
        assert 0 <= result.label_index <= 33
        assert result.pipeline == "B"
        assert result.latency_ms > 0

    def test_predict_random(self, encoder_model, lgbm_model):
        result = predict(RAND_63, encoder_model, lgbm_model)
        assert 0.0 <= result.confidence <= 1.0

    def test_probabilities_sum_to_one(self, encoder_model, lgbm_model):
        result = predict(RAND_63, encoder_model, lgbm_model)
        assert result.probabilities is not None
        total = sum(result.probabilities)
        assert abs(total - 1.0) < 1e-4, f"Probabilities sum to {total}"

    def test_probabilities_length(self, encoder_model, lgbm_model):
        result = predict(RAND_63, encoder_model, lgbm_model)
        assert len(result.probabilities) == 34

    def test_encoder_output_shape(self, encoder_model):
        """Encoder sub-model must produce a 16-D vector."""
        import numpy as np
        X = np.zeros((1, 63), dtype="float32")
        out = encoder_model(X, training=False).numpy()
        assert out.shape == (1, 16), f"Unexpected encoder output shape: {out.shape}"

    def test_different_inputs_give_different_outputs(self, encoder_model, lgbm_model):
        result_a = predict(ZEROS_63, encoder_model, lgbm_model)
        result_b = predict([0.5] * 63, encoder_model, lgbm_model)
        # At least the probabilities should differ (not a constant model)
        assert result_a.probabilities != result_b.probabilities
