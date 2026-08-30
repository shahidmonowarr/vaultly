'use client';

import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export default function CardMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(!open);
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface/95 text-ink-3 transition hover:text-ink ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
          <circle cx="10" cy="4.5" r="1.4" />
          <circle cx="10" cy="10" r="1.4" />
          <circle cx="10" cy="15.5" r="1.4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-[0_16px_40px_-20px_rgba(12,18,32,0.5)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`block w-full px-3 py-2 text-left text-[13px] transition hover:bg-ground ${
                item.danger ? 'text-danger' : 'text-ink-2'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
