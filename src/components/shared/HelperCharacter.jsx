import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

/**
 * Rocket — SmartSDR's site-wide guide character (by Netsmartz).
 * Default: a small floating rocket that gently idles. On hover (or tap) it
 * expands into a greeting card. Purely presentational today; the real chatbot
 * will dock in later via `onOpenChat`.
 */
const TIPS = [
  "Hi, I'm Rocket 🚀 Your guide around SmartSDR, built by Netsmartz.",
  'Two agents live here: Voice Agent calls & qualifies leads, Executive Analytics scores every call.',
  'Full conversational chat is on its way — for now, explore and I’ll point things out.',
];

export default function HelperCharacter({ onOpenChat }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);

  return (
    <div
      className="fixed bottom-6 right-5 z-[70] flex flex-col items-end gap-3 md:bottom-8 md:right-8"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-[19rem] rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 text-left shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center gap-2.5">
              <img src="/rocket.png" alt="Rocket" className="h-9 w-9 object-contain" />
              <span className="text-sm font-semibold text-[var(--ink)]">Rocket</span>
            </div>
            <p className="mt-3 text-[0.85rem] leading-relaxed text-[var(--ink)]/85">{TIPS[tip]}</p>
            <button
              onClick={() => (onOpenChat ? onOpenChat() : setTip((t) => (t + 1) % TIPS.length))}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--pine)] hover:text-[var(--pine-2)]"
            >
              <Sparkles className="h-3.5 w-3.5" /> Tell me more
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label="Rocket — your SmartSDR guide"
        animate={{ y: [0, -6, 0], rotate: [0, -3, 3, 0] }}
        transition={{ y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
        whileHover={{ scale: 1.08 }}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--stone)] shadow-[0_10px_30px_-6px_rgba(248,114,23,0.55)] ring-1 ring-[var(--line)]"
      >
        <span className="absolute inset-0 -z-10 rounded-full bg-[var(--pine)]/20 blur-md" />
        <img src="/rocket.png" alt="Rocket" className="h-12 w-12 object-contain" />
      </motion.button>
    </div>
  );
}
