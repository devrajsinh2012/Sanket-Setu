import { useEffect, useRef } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { HAND_CONNECTIONS } from '../lib/landmarkUtils';

interface Props {
  rawLandmarks: NormalizedLandmark[] | null;
  videoWidth: number;
  videoHeight: number;
  /** Pulse/glow when a sign was just recognised */
  recognised: boolean;
}

const DOT_RADIUS     = 5;
const NEON_CYAN      = '#00f5d4';
const NEON_PURPLE    = '#9b5de5';
const LINE_COLOR     = 'rgba(0, 245, 212, 0.55)';
const GLOW_COLOR_ON  = '#00f5d4';
const GLOW_COLOR_OFF = 'rgba(0,245,212,0.6)';

/**
 * Canvas overlay that draws MediaPipe hand landmarks on top of the webcam feed.
 * The canvas is absolutely positioned and sized to match the video element.
 */
export function LandmarkCanvas({ rawLandmarks, videoWidth, videoHeight, recognised }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!rawLandmarks || rawLandmarks.length !== 21) return;

    const w = canvas.width;
    const h = canvas.height;

    const px = (lm: NormalizedLandmark) => lm.x * w;
    const py = (lm: NormalizedLandmark) => lm.y * h;

    // ── Bones ────────────────────────────────────────────────────
    ctx.lineWidth = 2;
    ctx.strokeStyle = LINE_COLOR;
    ctx.shadowBlur  = recognised ? 12 : 6;
    ctx.shadowColor = LINE_COLOR;

    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(px(rawLandmarks[a]), py(rawLandmarks[a]));
      ctx.lineTo(px(rawLandmarks[b]), py(rawLandmarks[b]));
      ctx.stroke();
    }

    // ── Landmark dots ────────────────────────────────────────────
    const glowColor  = recognised ? GLOW_COLOR_ON : GLOW_COLOR_OFF;
    const glowRadius = recognised ? 20 : 10;

    for (let i = 0; i < rawLandmarks.length; i++) {
      const lm = rawLandmarks[i];
      const x  = px(lm);
      const y  = py(lm);

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS + 2, 0, Math.PI * 2);
      ctx.fillStyle   = 'transparent';
      ctx.shadowBlur  = glowRadius;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Filled dot (wrist = larger)
      ctx.beginPath();
      ctx.arc(x, y, i === 0 ? DOT_RADIUS + 2 : DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle   = i === 0 ? NEON_PURPLE : NEON_CYAN;
      ctx.shadowBlur  = recognised ? 16 : 8;
      ctx.shadowColor = i === 0 ? NEON_PURPLE : NEON_CYAN;
      ctx.fill();
    }

    // Reset shadow so it doesn't bleed onto future draws
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
  }, [rawLandmarks, recognised]);

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
