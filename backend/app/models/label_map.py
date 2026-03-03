"""
Label map: index 0–33 → Gujarati sign name.

The 34 classes cover the Gujarati consonant alphabet (ક–ળ / ક-ળ) as used in the
training dataset.  Verify this order against your original data-collection script /
notebook — if your dataset folder names differ, update the list below.

Current assumption: classes are sorted by the Gujarati alphabet order (Unicode order
of the Unicode Gujarati block, U+0A80–U+0AFF).
"""
from __future__ import annotations

# ---- Primary label map (index → Gujarati character / word) -----------------
# 34 classes: consonants + a few vowel signs used as standalone signs
LABEL_MAP: dict[int, str] = {
    0:  "ક",   # ka
    1:  "ખ",   # kha
    2:  "ગ",   # ga
    3:  "ઘ",   # gha
    4:  "ચ",   # cha
    5:  "છ",   # chha
    6:  "જ",   # ja
    7:  "ઝ",   # jha
    8:  "ટ",   # ṭa
    9:  "ઠ",   # ṭha
    10: "ડ",   # ḍa
    11: "ઢ",   # ḍha
    12: "ણ",   # ṇa
    13: "ત",   # ta
    14: "થ",   # tha
    15: "દ",   # da
    16: "ધ",   # dha
    17: "ન",   # na
    18: "પ",   # pa
    19: "ફ",   # pha
    20: "બ",   # ba
    21: "ભ",   # bha
    22: "મ",   # ma
    23: "ય",   # ya
    24: "ર",   # ra
    25: "લ",   # la
    26: "વ",   # va
    27: "શ",   # sha
    28: "ષ",   # ṣha
    29: "સ",   # sa
    30: "હ",   # ha
    31: "ળ",   # ḷa
    32: "ક્ષ", # ksha (conjunct)
    33: "જ્ઞ", # gna  (conjunct)
}

# Reverse map: sign name → index (useful for testing)
REVERSE_MAP: dict[str, int] = {v: k for k, v in LABEL_MAP.items()}


def get_sign(label_index: int) -> str:
    """Return the Gujarati sign for the given class index."""
    return LABEL_MAP.get(label_index, f"[{label_index}]")
