import { useEffect, useRef, useState, useCallback } from 'react';
import type { ModelMode, PredictionResponse } from '../types';

// Derive WebSocket base URL.
// Priority: VITE_WS_URL env var → dev fallback (port 8000) → same host (production).
function _defaultWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  // In Vite dev mode the frontend is served on 5173 but FastAPI runs on 8000.
  if (import.meta.env.DEV) return `${proto}://localhost:8000`;
  // In production the backend is co-located (HF Spaces Docker).
  return `${proto}://${window.location.host}`;
}
const WS_URL = _defaultWsUrl();
const RECONNECT_BASE_MS    = 1000;
const MAX_RECONNECT_MS     = 30_000;
const MAX_SEND_RATE        = 15; // frames/sec — normal
const LOW_BW_SEND_RATE     = 5;  // frames/sec — high-latency fallback
const LOW_BW_LATENCY_MS    = 500; // threshold to activate low-bandwidth mode

export interface WebSocketState {
  lastPrediction: PredictionResponse | null;
  isConnected: boolean;
  latency: number;
  lowBandwidth: boolean;
  sendLandmarks: (
    landmarks: number[],
    options?: {
      sessionId?: string;
      modelMode?: ModelMode;
      imageB64?: string;
    },
  ) => void;
}

/**
 * WebSocket hook for sending landmark vectors and receiving predictions.
 * Implements auto-reconnect with exponential back-off and send-rate throttling.
 */
export function useWebSocket(): WebSocketState {
  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(RECONNECT_BASE_MS);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSendTime   = useRef(0);

  const [lastPrediction, setLastPrediction] = useState<PredictionResponse | null>(null);
  const [isConnected,    setIsConnected]    = useState(false);
  const [latency,        setLatency]        = useState(0);
  const [lowBandwidth,   setLowBandwidth]   = useState(false);

  const inflightTs = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_URL}/ws/landmarks`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectDelay.current = RECONNECT_BASE_MS;
    };

    ws.onmessage = (evt) => {
      if (inflightTs.current !== null) {
        const rtt = Date.now() - inflightTs.current;
        setLatency(rtt);
        setLowBandwidth(rtt > LOW_BW_LATENCY_MS);
        inflightTs.current = null;
      }
      try {
        const data: PredictionResponse = JSON.parse(evt.data);
        if ('sign' in data) setLastPrediction(data);
      } catch {
        // ignore non-JSON messages / error frames
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Exponential back-off reconnect
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_MS);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = (e) => {
      console.warn('WebSocket error', e);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  /** Throttled send — adapts to 5fps in low-bandwidth mode (latency > 500ms) */
  const sendLandmarks = useCallback((
    landmarks: number[],
    options?: {
      sessionId?: string;
      modelMode?: ModelMode;
      imageB64?: string;
    },
  ) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    const effectiveRate = lowBandwidth ? LOW_BW_SEND_RATE : MAX_SEND_RATE;
    const minInterval = 1000 / effectiveRate;
    if (now - lastSendTime.current < minInterval) return;
    lastSendTime.current = now;

    inflightTs.current = now;
    ws.send(JSON.stringify({
      landmarks,
      session_id: options?.sessionId ?? 'browser',
      model_mode: options?.modelMode,
      image_b64: options?.imageB64,
    }));
  }, [lowBandwidth]);

  return { lastPrediction, isConnected, latency, lowBandwidth, sendLandmarks };
}
