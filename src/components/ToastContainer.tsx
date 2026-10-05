import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import type { Toast } from '../types';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
} as const;

const STYLES = {
  success: 'text-emerald-400 border-emerald-500/30',
  error: 'text-rose-400 border-rose-500/30',
  info: 'text-cyan-400 border-cyan-500/30',
  warning: 'text-amber-400 border-amber-500/30',
} as const;

export default function ToastContainer({ toasts, onDismiss }: Props) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => onDismiss(t.id), 4000),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type];
        return (
          <div
            key={toast.id}
            className={`tg2a flex items-start gap-2.5 bg-[#0d1629] border rounded-lg px-3.5 py-3 shadow-xl animate-[slideIn_.2s_ease-out] ${STYLES[toast.type]}`}
            style={{ animation: 'toastIn 0.2s ease-out' }}
          >
            <Icon className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 leading-snug">{toast.message}</p>
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    onDismiss(toast.id);
                  }}
                  className="mt-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {toast.action.label} →
                </button>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}