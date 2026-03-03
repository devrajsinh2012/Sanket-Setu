/**
 * Shared TypeScript types for SanketSetu frontend.
 */

export interface PredictionResponse {
  sign: string;
  confidence: number;
  pipeline: string;
  label_index: number;
  probabilities?: number[];
  latency_ms?: number;
}

export interface HealthResponse {
  status: string;
  models_loaded: boolean;
  pipelines_available: string[];
}

/** Normalised 21-landmark hand data from MediaPipe */
export interface HandLandmarks {
  landmarks: number[];   // flat [x0,y0,z0 … x20,y20,z20] — 63 floats
  handedness: 'Left' | 'Right';
}
