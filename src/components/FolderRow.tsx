'use client';

import { useState } from 'react';
import type { Folder } from '@/lib/types';

interface Props {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onDropFiles: (folderId: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

export default function FolderRow({ folder, onOpen, onDropFiles, onRename, onDelete }: Props) {
  const [over, setOver] = useState(false);

  return (
    <li>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          onDropFiles(folder.id);
        }}
        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
          over ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-surface/70'
        }`}
      >
        <button
          type="button"
          onClick={() => onOpen(folder)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-ground"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-ink-3">
              <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3.379a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 10.12 6H16.5A1.5 1.5 0 0 1 18 7.5v7A1.5 1.5 0 0 1 16.5 16h-13A1.5 1.5 0 0 1 2 14.5v-9Z" />
            </svg>
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{folder.name}</span>
            <span className="mt-0.5 block font-mono text-xs text-ink-3">folder</span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onRename(folder)}
            className="text-[13px] font-medium text-ink-3 transition hover:text-ink"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => onDelete(folder)}
            className="text-[13px] font-medium text-danger transition hover:brightness-90"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
