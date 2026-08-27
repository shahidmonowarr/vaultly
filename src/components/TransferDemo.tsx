'use client';

import { useEffect, useState } from 'react';

const TOTAL_PARTS = 16;
const FILE_MB = 120;
const IN_FLIGHT = 3;

export default function TransferDemo() {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) {
      setDone(TOTAL_PARTS);
      return;
    }

    const timer = setInterval(() => {
      setDone((current) => (current >= TOTAL_PARTS ? 0 : current + 1));
    }, 420);

    return () => clearInterval(timer);
  }, []);

  const transferred = Math.round((done / TOTAL_PARTS) * FILE_MB * 10) / 10;

  return (
    <figure className="m-0 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(12,18,32,0.04),0_12px_32px_-12px_rgba(12,18,32,0.18)]">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[13px] text-ink">field-archive.zip</span>
        <span className="tabular font-mono text-[13px] text-ink-3">{FILE_MB}.0 MB</span>
      </figcaption>

      <div className="mt-4 grid grid-cols-8 gap-1.5" aria-hidden="true">
        {Array.from({ length: TOTAL_PARTS }, (_, index) => {
          const complete = index < done;
          const flying = !complete && index < done + IN_FLIGHT;

          return (
            <span
              key={index}
              className={`h-7 rounded-[3px] transition-colors duration-300 ${
                complete
                  ? 'bg-accent'
                  : flying
                    ? 'animate-pulse bg-accent-soft'
                    : 'bg-[#eef1f6]'
              }`}
            />
          );
        })}
      </div>

      <div className="mt-4 h-px w-full bg-line" />

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="tabular font-mono text-[13px] text-ink-2">
          part {String(Math.min(done + 1, TOTAL_PARTS)).padStart(2, '0')} / {TOTAL_PARTS}
        </span>
        <span className="tabular font-mono text-[13px] text-ink-3">
          {transferred.toFixed(1)} MB transferred
        </span>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
        Sixteen parts, three moving at once, sent from the browser straight to object
        storage. The application server signs the upload and never sees the bytes.
      </p>
    </figure>
  );
}
