'use client';

import type { Crumb } from '@/lib/types';

interface Props {
  trail: Crumb[];
  onNavigate: (folderId: string | null) => void;
  onDropFiles?: (folderId: string | null) => void;
}

export default function Breadcrumbs({ trail, onNavigate, onDropFiles }: Props) {
  const crumbs: (Crumb | null)[] = [null, ...trail];

  return (
    <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        const id = crumb?.id ?? null;

        return (
          <span key={id ?? 'root'} className="flex items-center gap-1">
            {index > 0 && <span className="text-ink-3">/</span>}

            {last ? (
              <span className="font-medium">{crumb?.name ?? 'All files'}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(id)}
                onDragOver={(event) => onDropFiles && event.preventDefault()}
                onDrop={(event) => {
                  if (!onDropFiles) return;
                  event.preventDefault();
                  onDropFiles(id);
                }}
                className="rounded px-1 py-0.5 text-ink-3 transition hover:bg-surface hover:text-ink"
              >
                {crumb?.name ?? 'All files'}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
