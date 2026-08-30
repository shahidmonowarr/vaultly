'use client';

import { useState } from 'react';
import CardMenu from '@/components/CardMenu';
import type { Folder } from '@/lib/types';

interface Props {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onDropFiles: (folderId: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

export default function FolderTile({ folder, onOpen, onDropFiles, onRename, onDelete }: Props) {
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
        className={`group relative rounded-xl border transition ${
          over ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
        }`}
      >
        <div className="absolute right-2.5 top-2.5 z-10">
          <CardMenu
            label={`Actions for ${folder.name}`}
            items={[
              { label: 'Rename', onSelect: () => onRename(folder) },
              { label: 'Delete', onSelect: () => onDelete(folder), danger: true },
            ]}
          />
        </div>

        <button type="button" onClick={() => onOpen(folder)} className="block w-full px-3 py-5">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="mx-auto h-9 w-9 fill-ink-3">
            <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3.379a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 10.12 6H16.5A1.5 1.5 0 0 1 18 7.5v7A1.5 1.5 0 0 1 16.5 16h-13A1.5 1.5 0 0 1 2 14.5v-9Z" />
          </svg>

          <span className="mt-2 block truncate text-center text-[13px] font-medium">
            {folder.name}
          </span>
        </button>
      </div>
    </li>
  );
}
