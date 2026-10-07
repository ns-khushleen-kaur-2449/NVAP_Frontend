import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function SuccessToast({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      onClose?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed right-6 top-24 z-50 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
        >
             {'\u2713'} Call scheduled successfully
        </motion.div>
      )}
    </AnimatePresence>
  );
}
