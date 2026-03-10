import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Zap, Clock } from 'lucide-react';
import type { ModelMode, PredictionResponse } from '../types';

interface Props {
  prediction: PredictionResponse | null;
  isConnected: boolean;
  latency: number;
  lowBandwidth?: boolean;
  selectedModel: ModelMode;
}

const PIPELINE_COLORS: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-sky-400',
  C: 'text-purple-400',
  ensemble: 'text-amber-400',
};

const PIPELINE_LABELS: Record<string, string> = {
  A: 'XGBoost',
  B: 'AE + LGBM',
  C: 'CNN + SVM',
  ensemble: 'A -> B -> C fallback',
};

function confidenceColor(c: number) {
  if (c >= 0.85) return '#00f5d4';    // neon-cyan
  if (c >= 0.60) return '#fee440';    // yellow
  return '#f15bb5';                   // pink-red
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
      <motion.div
        className="h-2 rounded-full"
        style={{ background: confidenceColor(value) }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  );
}

/**
 * Floating HUD panel that shows the current sign prediction, confidence,
 * active pipeline, latency and a rolling history of the last 10 signs.
 */
export function PredictionHUD({ prediction, isConnected, latency, lowBandwidth = false, selectedModel }: Props) {
  const [history, setHistory] = useState<PredictionResponse[]>([]);
  const prevSignRef = useRef<string | null>(null);

  // Add to history only when the sign changes
  useEffect(() => {
    if (!prediction) return;
    if (prediction.sign === prevSignRef.current) return;
    prevSignRef.current = prediction.sign;
    setHistory(prev => [prediction, ...prev].slice(0, 10));
  }, [prediction]);

  const pipelineKey = prediction?.pipeline ?? 'A';
  const pipelineColor = PIPELINE_COLORS[pipelineKey] ?? 'text-slate-400';
  const pipelineLabel = PIPELINE_LABELS[pipelineKey] ?? pipelineKey;
  const selectedLabel = PIPELINE_LABELS[selectedModel] ?? selectedModel;

  return (
    <div className="glass glow-border flex flex-col gap-3 sm:gap-4 p-3 sm:p-5 w-full lg:min-w-[260px] lg:max-w-xs">
      {/* Connection status */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: isConnected ? '#00f5d4' : '#f15bb5',
                     boxShadow: isConnected ? '0 0 8px #00f5d4' : '0 0 8px #f15bb5' }}
          />
          {isConnected ? 'Connected' : 'Reconnecting…'}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {latency > 0 ? `${latency}ms` : '—'}
          {lowBandwidth && (
            <span
              title="Low-bandwidth mode: 5fps"
              className="ml-1 text-yellow-400 font-semibold"
              style={{ fontSize: '10px' }}
            >
              LB
            </span>
          )}
        </span>
      </div>

      {/* Main content: sign + history side by side on mobile, stacked on lg */}
      <div className="flex lg:flex-col gap-3">
        {/* Main sign display */}
        <div className="flex flex-col items-center justify-center gap-1 py-1 sm:py-2 min-w-[80px] sm:min-w-0">
          <AnimatePresence mode="popLayout">
            {prediction ? (
              <motion.div
                key={prediction.sign}
                initial={{ opacity: 0, scale: 0.6, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                className="glow-text font-bold select-none leading-none"
                style={{ color: '#00f5d4', fontSize: 'clamp(2.5rem, 10vw, 4.5rem)' }}
              >
                {prediction.sign}
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                className="font-bold text-slate-500 select-none leading-none"
                style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
              >
                ?
              </motion.div>
            )}
          </AnimatePresence>
          <span className="text-[10px] text-slate-500 mt-0.5">Current sign</span>
        </div>

        {/* Right column on mobile: confidence + pipeline + history */}
        <div className="flex flex-1 flex-col gap-2 justify-center">
          {/* Confidence bar */}
          {prediction && (
            <div className="w-full">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Confidence</span>
                <span style={{ color: confidenceColor(prediction.confidence) }}>
                  {Math.round(prediction.confidence * 100)}%
                </span>
              </div>
              <ConfidenceBar value={prediction.confidence} />
            </div>
          )}

          {/* Pipeline badge */}
          {prediction && (
            <div className="flex items-center gap-1.5 text-xs">
              <Cpu size={12} className={pipelineColor} />
              <span className={pipelineColor}>Pipeline {pipelineKey}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{pipelineLabel}</span>
            </div>
          )}

          <div className="text-xs text-slate-500">
            Selected mode: <span className="text-slate-300">{selectedModel} ({selectedLabel})</span>
          </div>

          {/* History */}
          <div>
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Zap size={11} /> Recent signs
            </p>
            <div className="flex flex-wrap gap-1">
              <AnimatePresence>
                {history.map((h, i) => (
                  <motion.span
                    key={`${h.sign}-${i}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1 - i * 0.08, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={{ duration: 0.2 }}
                    className="px-1.5 py-0.5 rounded-full font-semibold"
                    style={{
                      background: 'rgba(0,245,212,0.08)',
                      border: '1px solid rgba(0,245,212,0.2)',
                      color: '#00f5d4',
                      fontSize: i === 0 ? '1rem' : '0.75rem',
                    }}
                  >
                    {h.sign}
                  </motion.span>
                ))}
              </AnimatePresence>
              {history.length === 0 && (
                <span className="text-xs text-slate-600 italic">None yet</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
