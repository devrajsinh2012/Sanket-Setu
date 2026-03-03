"""
tests/test_pipeline_a.py — XGBoost landmark inference.
"""
from __future__ import annotations

import pytest
from app.inference.pipeline_a import predict
from app.models.label_map import LABEL_MAP


# ---------------------------------------------------------------------------
# Common fixtures
# ---------------------------------------------------------------------------

ZEROS_63  = [0.0] * 63
RAND_63   = [float(i % 11) / 10.0 for i in range(63)]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPipelineA:

    def test_predict_zeros(self, xgb_model):
        """All-zero landmarks should return a valid PredictionResult."""
        result = predict(ZEROS_63, xgb_model)
        assert result.sign is not None
        assert 0.0 <= result.confidence <= 1.0
        assert 0 <= result.label_index <= 33
        assert result.pipeline == "A"
        assert result.latency_ms > 0

    def test_predict_random_input(self, xgb_model):
        result = predict(RAND_63, xgb_model)
        assert 0.0 <= result.confidence <= 1.0
        assert 0 <= result.label_index <= 33

    def test_probabilities_sum_to_one(self, xgb_model):
        result = predict(RAND_63, xgb_model)
        assert result.probabilities is not None
        total = sum(result.probabilities)
        assert abs(total - 1.0) < 1e-4, f"Probabilities sum to {total}"

    def test_probabilities_length(self, xgb_model):
        result = predict(RAND_63, xgb_model)
        assert len(result.probabilities) == 34

    def test_sign_in_label_map(self, xgb_model):
        result = predict(RAND_63, xgb_model)
        assert result.sign == LABEL_MAP.get(result.label_index, "?"), (
            f"sign '{result.sign}' doesn't match label_map[{result.label_index}]"
        )

    def test_confidence_equals_max_prob(self, xgb_model):
        result = predict(RAND_63, xgb_model)
        assert abs(result.confidence - max(result.probabilities)) < 1e-6

    @pytest.mark.parametrize("bad_input", [
        [0.0] * 62,   # too short
        [0.0] * 64,   # too long
    ])
    def test_rejects_wrong_length(self, xgb_model, bad_input):
        """XGBoost should raise if input has wrong feature count."""
        with pytest.raises(Exception):
            predict(bad_input, xgb_model)
