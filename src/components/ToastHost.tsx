import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Undo2 } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastHostProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl shadow-black/40 min-w-[280px] max-w-[92vw]"
          >
            <span className="text-sm text-zinc-200 flex-1">{t.message}</span>
            {t.actionLabel && t.onAction && (
              <button
                onClick={() => { t.onAction?.(); onDismiss(t.id); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
              >
                <Undo2 size={14} /> {t.actionLabel}
              </button>
            )}
            <button onClick={() => onDismiss(t.id)} className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors shrink-0">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
