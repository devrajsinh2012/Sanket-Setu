import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';

interface Props {
  handDetected: boolean;
  onReady: () => void;
}

const STABLE_DURATION_MS = 1000; // hand must be visible for this long

/**
 * Brief calibration screen shown after onboarding.
 * Waits until a hand is stable in frame, then auto-transitions.
 */
export function Calibration({ handDetected, onReady }: Props) {
  const [stableMs, setStableMs] = useState(0);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    if (!handDetected) {
      setStableMs(0);
      return;
    }
    const interval = setInterval(() => {
      setStableMs(prev => {
        const next = prev + 100;
        if (next >= STABLE_DURATION_MS && !done) {
          setDone(true);
          setTimeout(onReady, 600); // brief pause before transitioning
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [handDetected, done, onReady]);

  const progress  = Math.min((stableMs / STABLE_DURATION_MS) * 100, 100);
  const isChecked = done;

  return (
    /* Transparent outer overlay — camera feed stays fully visible behind */
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-end pb-10 pointer-events-none">

      {/* Compact card anchored at the bottom so the camera is unobstructed */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto flex flex-col items-center gap-5 px-8 py-6 rounded-2xl"
        style={{
          background: 'rgba(5,8,22,0.88)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold glow-text"
        >
          Ready?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-slate-400 text-center text-sm max-w-xs"
        >
          {handDetected
            ? 'Hand detected — hold steady…'
            : 'Show your hand to the camera above.'}
        </motion.p>

        {/* Circular progress / check */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <motion.circle
              cx="48" cy="48" r="40"
              fill="none"
              stroke="#00f5d4"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - progress / 100) }}
              transition={{ duration: 0.1 }}
              style={{ filter: 'drop-shadow(0 0 6px #00f5d4)' }}
            />
          </svg>

          <AnimatePresence mode="wait">
            {isChecked ? (
              <motion.div
                key="check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <CheckCircle size={36} style={{ color: '#00f5d4' }} />
              </motion.div>
            ) : (
              <motion.div key="spinner" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={28} strokeWidth={1.5} style={{ color: handDetected ? '#00f5d4' : '#4b5563' }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-xs text-slate-500">
          {isChecked ? 'All set!' : 'Keep your hand visible for 1 second'}
        </p>
      </motion.div>
    </div>
  );
}
