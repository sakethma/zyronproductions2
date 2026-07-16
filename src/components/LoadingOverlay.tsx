import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Sparkles, Cpu, CreditCard } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  title?: string;
  statusMessages?: string[];
}

export default function LoadingOverlay({
  isVisible,
  title = 'ZYRON RESERVATION ENGINE',
  statusMessages = [
    'Validating secure token...',
    'Allocating capacity and tier...',
    'Contacting secure payment gateway...',
    'Encrypting admission keypair...',
    'Generating secure QR credentials...',
  ],
}: LoadingOverlayProps) {
  const [currentMsgIdx, setCurrentMsgIdx] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setCurrentMsgIdx(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentMsgIdx((prev) => (prev + 1) % statusMessages.length);
    }, 1200);

    return () => clearInterval(interval);
  }, [isVisible, statusMessages]);

  const icons = [
    <Cpu className="h-5 w-5 text-violet-500 animate-pulse" key="cpu" />,
    <Sparkles className="h-5 w-5 text-purple-500 animate-bounce" key="sparkles" />,
    <CreditCard className="h-5 w-5 text-fuchsia-500" key="card" />,
    <ShieldCheck className="h-5 w-5 text-violet-400" key="shield" />,
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-neutral-950/90 dark:bg-black/95 backdrop-blur-md px-4"
        >
          {/* Subtle concentric ambient circles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full border border-violet-500/10 pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-purple-500/5 pointer-events-none animate-spin-slow"></div>

          {/* Central content container */}
          <div className="relative flex flex-col items-center max-w-sm w-full text-center space-y-8 z-10">
            {/* Spinning/glowing aperture ring */}
            <div className="relative flex items-center justify-center h-24 w-24">
              {/* Outer pulsing glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-600 via-purple-600 to-fuchsia-600 opacity-20 blur-xl animate-pulse-slow"></div>
              
              {/* Spinning borders */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/20"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-2 rounded-full border border-t-2 border-b-2 border-violet-500 dark:border-white"
              />
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="h-10 w-10 bg-neutral-950 dark:bg-neutral-900 flex items-center justify-center rounded-full border border-neutral-800"
              >
                <span className="text-[10px] font-mono font-bold text-violet-500 dark:text-white">ZR</span>
              </motion.div>
            </div>

            {/* Title & Metadata */}
            <div className="space-y-1">
              <span className="text-[9px] font-mono tracking-[0.3em] text-neutral-400 uppercase">
                SECURE TRANSACTION
              </span>
              <h2 className="font-serif text-xl font-bold tracking-tight text-white">
                {title}
              </h2>
            </div>

            {/* Stepper text */}
            <div className="h-14 flex items-center justify-center w-full px-4 border-y border-neutral-800 py-3.5 bg-neutral-950/40">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMsgIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center space-x-3 text-xs font-mono text-neutral-300"
                >
                  {icons[currentMsgIdx % icons.length]}
                  <span>{statusMessages[currentMsgIdx]}</span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Action disclaimer */}
            <p className="text-[10px] font-sans text-neutral-500 leading-normal max-w-xs">
              Please do not refresh the browser or click the back button. Your transaction is encrypted and pending authorization.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
