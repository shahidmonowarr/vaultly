'use client';

import CardMenu from '@/components/CardMenu';
import { fileLabel } from '@/lib/fileKind';
import { formatBytes } from '@/lib/format';
import { previewKind } from '@/lib/preview';
import type { StoredFile } from '@/lib/types';

interface Props {
  file: StoredFile;
  selected: boolean;
  checked: boolean;
  onSelect: (file: StoredFile) => void;
  onToggleCheck: (file: StoredFile, shiftKey: boolean) => void;
  onDragStart: (file: StoredFile) => void;
  onCopyLink: (file: StoredFile) => void;
  onMove: (file: StoredFile) => void;
  onDelete: (file: StoredFile) => void;
}

export default function FileCard({
  file,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  onDragStart,
  onCopyLink,
  onMove,
  onDelete,
}: Props) {
  const kind = previewKind(file.mimeType);
  const isPublic = file.visibility === 'public';
  const inlineUrl = `/api/v1/files/${file.id}/download?inline=1`;

  const items = [
    ...(file.shareUrl ? [{ label: 'Copy link', onSelect: () => onCopyLink(file) }] : []),
    { label: 'Move to', onSelect: () => onMove(file) },
    { label: 'Delete', onSelect: () => onDelete(file), danger: true },
  ];

  return (
    <li>
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', file.id);
          onDragStart(file);
        }}
        className={`group relative overflow-hidden rounded-xl border bg-surface transition ${
          selected ? 'border-accent shadow-[0_1px_2px_rgba(12,18,32,0.06)]' : 'border-line hover:border-line-strong'
        }`}
      >
        <div className="absolute left-2.5 top-2.5 z-10">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) =>
              onToggleCheck(file, (event.nativeEvent as MouseEvent).shiftKey ?? false)
            }
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select ${file.name}`}
            className={`h-4 w-4 accent-[var(--color-accent)] transition ${
              checked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            }`}
          />
        </div>

        <div className="absolute right-2.5 top-2.5 z-10">
          <CardMenu items={items} label={`Actions for ${file.name}`} />
        </div>

        <button
          type="button"
          onClick={() => onSelect(file)}
          aria-current={selected}
          className="block w-full"
        >
          <span className="flex h-28 w-full items-center justify-center overflow-hidden bg-ground">
            {kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={inlineUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-mono text-sm tracking-widest text-ink-3">
                {fileLabel(file.name, file.mimeType)}
              </span>
            )}
          </span>

          <span className="block border-t border-line px-3 py-2.5 text-left">
            <span className="block truncate text-[13px] font-medium">{file.name}</span>

            <span className="mt-1 flex items-center justify-between gap-2">
              <span className="tabular font-mono text-[11px] text-ink-3">
                {formatBytes(file.size)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                  isPublic ? 'bg-signal-soft text-signal' : 'bg-ground text-ink-3'
                }`}
              >
                {isPublic ? 'public' : 'private'}
              </span>
            </span>
          </span>
        </button>
      </div>
    </li>
  );
}
