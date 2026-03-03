import { useEffect, useRef, useState, useCallback } from 'react';
import {
  HandLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { normaliseLandmarks } from '../lib/landmarkUtils';

export interface MediaPipeState {
  landmarks: number[] | null;          // 63-float normalised vector
  rawLandmarks: NormalizedLandmark[] | null; // 21-point raw result (for canvas drawing)
  handedness: 'Left' | 'Right' | null;
  isDetecting: boolean;
  isLoading: boolean;
  error: string | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
}

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * Hook that drives MediaPipe HandLandmarker inference on a video element.
 * Runs at ~30 fps using requestAnimationFrame.
 */
export function useMediaPipe(): MediaPipeState {
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef        = useRef<number>(0);
  const lastTsRef     = useRef<number>(0);

  const [landmarks,    setLandmarks]    = useState<number[] | null>(null);
  const [rawLandmarks, setRawLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [handedness,   setHandedness]   = useState<'Left' | 'Right' | null>(null);
  const [isDetecting,  setIsDetecting]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // initialise on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const hl = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (!cancelled) {
          landmarkerRef.current = hl;
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('MediaPipe init error', err);
          setError('Failed to load hand detection model. Check network.');
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
    };
  }, []);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    if (!landmarkerRef.current) return;
    setIsDetecting(true);

    const detect = (now: number) => {
      if (!landmarkerRef.current || !video || video.paused || video.ended) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      // Throttle to ~30 fps
      if (now - lastTsRef.current < 33) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }
      lastTsRef.current = now;

      let result: HandLandmarkerResult;
      try {
        result = landmarkerRef.current.detectForVideo(video, now);
      } catch {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      if (result.handednesses.length > 0 && result.landmarks.length > 0) {
        const raw = result.landmarks[0];          // NormalizedLandmark[]
        const hand = result.handednesses[0][0].categoryName as 'Left' | 'Right';
        try {
          const flat = normaliseLandmarks(raw);
          setLandmarks(flat);
          setRawLandmarks(raw);
          setHandedness(hand);
        } catch {
          setLandmarks(null);
          setRawLandmarks(null);
        }
      } else {
        setLandmarks(null);
        setRawLandmarks(null);
        setHandedness(null);
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  const stopDetection = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsDetecting(false);
    setLandmarks(null);
    setRawLandmarks(null);
    setHandedness(null);
  }, []);

  return {
    landmarks,
    rawLandmarks,
    handedness,
    isDetecting,
    isLoading,
    error,
    startDetection,
    stopDetection,
  };
}
