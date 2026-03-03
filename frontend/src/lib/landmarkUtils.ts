/**
 * Landmark utility functions — mirrors the backend preprocessing.
 *
 * The XGBoost model (Pipeline A) was trained on MediaPipe landmarks that are
 * already normalised to [0,1] relative to the image frame.  The simplest
 * preprocessing that makes the model translation-invariant is to subtract the
 * wrist landmark (index 0) so every coordinate is relative to the wrist.
 *
 * ⚠️  If your training notebook used a different normalisation (e.g. min-max
 *     scaling or only x/y without z), update normaliseLandmarks() to match.
 */

/** MediaPipe Hands result landmark shape */
export interface RawLandmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Convert MediaPipe NormalizedLandmark[] (21 points) to a flat 63-element
 * array, then subtract the wrist position to centre the hand.
 */
export function normaliseLandmarks(raw: RawLandmark[]): number[] {
  if (raw.length !== 21) {
    throw new Error(`Expected 21 landmarks, got ${raw.length}`);
  }

  const wrist = raw[0];

  const flat: number[] = [];
  for (const lm of raw) {
    flat.push(lm.x - wrist.x, lm.y - wrist.y, lm.z - wrist.z);
  }
  return flat; // length 63
}

/**
 * MediaPipe hand topology — pairs of landmark indices that form bones.
 * Used by LandmarkCanvas to draw connections between landmarks.
 */
export const HAND_CONNECTIONS: [number, number][] = [
  // Palm
  [0, 1], [1, 2], [2, 3], [3, 4],         // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // Index
  [5, 9], [9, 10], [10, 11], [11, 12],     // Middle
  [9, 13], [13, 14], [14, 15], [15, 16],   // Ring
  [13, 17], [17, 18], [18, 19], [19, 20],  // Pinky
  [0, 17],                                  // Wrist–pinky base
];
