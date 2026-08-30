'use client';

import Link from 'next/link';
import { formatBytes } from '@/lib/format';
import type { StorageUsage } from '@/lib/types';

export type View = 'files' | 'recent' | 'shared';

const VIEWS: { value: View; label: string; hint: string }[] = [
  { value: 'files', label: 'All files', hint: 'Browse folders' },
  { value: 'recent', label: 'Recent', hint: 'Newest first, every folder' },
  { value: 'shared', label: 'Shared', hint: 'Anything with a live link' },
];

interface Props {
  email: string;
  view: View;
  storage: StorageUsage | null;
  sharedCount: number;
  onChangeView: (view: View) => void;
  onUpload: () => void;
  onSignOut: () => void;
}

export default function Sidebar({
  email,
  view,
  storage,
  sharedCount,
  onChangeView,
  onUpload,
  onSignOut,
}: Props) {
  const usedPercent = storage ? Math.min(100, (storage.used / storage.quota) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" className="px-2 font-display text-lg font-bold tracking-tight">
        Vaultly
      </Link>

      <button
        type="button"
        onClick={onUpload}
        className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent"
      >
        Upload files
      </button>

      <nav className="flex flex-col gap-0.5">
        {VIEWS.map((item) => {
          const active = view === item.value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChangeView(item.value)}
              aria-current={active ? 'page' : undefined}
              title={item.hint}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                active ? 'bg-accent-soft font-medium text-accent' : 'text-ink-2 hover:bg-ground'
              }`}
            >
              {item.label}
              {item.value === 'shared' && sharedCount > 0 && (
                <span className="tabular font-mono text-xs text-ink-3">{sharedCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="px-1">
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ink" style={{ width: `${usedPercent}%` }} />
          </div>
          <p className="tabular mt-2 font-mono text-[11px] text-ink-3">
            {storage ? `${formatBytes(storage.used)} of ${formatBytes(storage.quota)}` : '—'}
          </p>
        </div>

        <div className="border-t border-line pt-3">
          <p className="truncate px-1 font-mono text-[11px] text-ink-3">{email}</p>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-1.5 px-1 text-[13px] font-medium text-ink-2 transition hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
