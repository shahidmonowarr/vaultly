'use client';

import { useCallback, useEffect, useState } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { api } from '@/lib/api';
import type { Crumb, FileListResponse, Folder } from '@/lib/types';

interface Props {
  open: boolean;
  count: number;
  onMove: (folderId: string | null) => void;
  onCancel: () => void;
}

/**
 * Browses the same listing endpoint rather than loading a whole tree, so a person picks a
 * destination the same way they navigate everywhere else.
 */
export default function MoveDialog({ open, count, onMove, onCancel }: Props) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [trail, setTrail] = useState<Crumb[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (target: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '1' });
      if (target) params.set('folder', target);

      const response = await api<FileListResponse>(`/api/v1/files?${params}`);
      setFolders(response.folders);
      setTrail(response.breadcrumb);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    setFolderId(null);
    void load(null);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-5 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_60px_-24px_rgba(12,18,32,0.6)]"
      >
        <h2 id="move-title" className="font-display text-lg font-bold tracking-tight">
          Move {count} {count === 1 ? 'file' : 'files'}
        </h2>

        <div className="mt-4">
          <Breadcrumbs
            trail={trail}
            onNavigate={(target) => {
              setFolderId(target);
              void load(target);
            }}
          />
        </div>

        <ul className="mt-3 min-h-32 flex-1 overflow-y-auto rounded-xl border border-line">
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                onClick={() => {
                  setFolderId(folder.id);
                  void load(folder.id);
                }}
                className="flex w-full items-center gap-2 border-b border-line px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-ground"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 fill-ink-3">
                  <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3.379a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 10.12 6H16.5A1.5 1.5 0 0 1 18 7.5v7A1.5 1.5 0 0 1 16.5 16h-13A1.5 1.5 0 0 1 2 14.5v-9Z" />
                </svg>
                <span className="truncate">{folder.name}</span>
              </button>
            </li>
          ))}

          {folders.length === 0 && (
            <li className="px-3 py-8 text-center text-[13px] text-ink-3">
              {loading ? 'Loading' : 'No folders in here'}
            </li>
          )}
        </ul>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium transition hover:border-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onMove(folderId)}
            className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent"
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}
