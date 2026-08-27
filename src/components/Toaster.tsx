'use client';

import { useEffect } from 'react';

export interface Toast {
  id: number;
  message: string;
  tone: 'neutral' | 'danger';
}

export default function Toaster({
  toasts,
  onExpire,
}: {
  toasts: Toast[];
  onExpire: (id: number) => void;
}) {
  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) => setTimeout(() => onExpire(toast.id), 3200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onExpire]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-5"
    >
      {toasts.map((toast) => (
        <p
          key={toast.id}
          className={`pointer-events-auto rounded-xl px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(12,18,32,0.5)] ${
            toast.tone === 'danger' ? 'bg-danger' : 'bg-ink'
          }`}
        >
          {toast.message}
        </p>
      ))}
    </div>
  );
}
