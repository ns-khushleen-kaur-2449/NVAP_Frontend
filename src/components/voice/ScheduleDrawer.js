import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function ScheduleDrawer({ open, onOpenChange, title, subtitle, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 sm:bg-black/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed right-0 top-0 z-50 flex h-full w-full flex-col rounded-none border-l border-border bg-card shadow-xl sm:w-[380px] lg:w-[420px]"
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="flex items-start justify-between border-b border-border px-5 py-4">
                  <div>
                    <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                    <Dialog.Description className="text-xs text-muted-foreground">
                      {subtitle}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close schedule drawer"
                      className="rounded-full p-2 text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
