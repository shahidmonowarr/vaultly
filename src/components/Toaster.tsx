'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
  tone: 'neutral' | 'danger';
}

const LIFETIME = 4000;
const EXIT = 160;

export default function Toaster({
  toasts,
  onExpire,
}: {
  toasts: Toast[];
  onExpire: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onExpire={onExpire} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onExpire }: { toast: Toast; onExpire: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const dismiss = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => onExpire(toast.id), EXIT);
  }, [onExpire, toast.id]);

  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(dismiss, LIFETIME);
  }, [dismiss]);

  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
  }, [start]);

  const danger = toast.tone === 'danger';

  return (
    <div
      role={danger ? 'alert' : 'status'}
      // Hovering holds the message open: people reach for a toast precisely when they
      // are still reading it.
      onMouseEnter={() => window.clearTimeout(timer.current)}
      onMouseLeave={start}
      className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-surface px-4 py-3 shadow-[0_12px_32px_-12px_rgba(12,18,32,0.4)] ${
        danger ? 'border-[#f2c8c4]' : 'border-line'
      } ${
        leaving
          ? 'translate-y-[-6px] scale-[0.98] opacity-0 transition-all duration-150'
          : 'animate-[toast-in_180ms_ease-out]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          danger ? 'bg-[#fdf2f1] text-danger' : 'bg-accent-soft text-accent'
        }`}
      >
        {danger ? (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
            <path d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm.9 11.2H9.1v-1.8h1.8v1.8Zm0-3.1H9.1V5.8h1.8v4.8Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
            <path d="M8.3 13.6 4.7 10l1.3-1.3 2.3 2.3 5.7-5.7L15.3 6.6l-7 7Z" />
          </svg>
        )}
      </span>

      <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{toast.message}</p>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-md p-1 text-ink-3 transition hover:text-ink"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
          <path d="M15 6.3 13.7 5 10 8.7 6.3 5 5 6.3 8.7 10 5 13.7 6.3 15 10 11.3l3.7 3.7 1.3-1.3-3.7-3.7L15 6.3Z" />
        </svg>
      </button>
    </div>
  );
}
