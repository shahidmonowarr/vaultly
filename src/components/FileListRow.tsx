'use client';

import FileMark from '@/components/FileMark';
import { formatBytes, formatDate } from '@/lib/format';
import { previewKind } from '@/lib/preview';
import type { StoredFile } from '@/lib/types';

interface Props {
  file: StoredFile;
  selected: boolean;
  checked: boolean;
  onSelect: (file: StoredFile) => void;
  onToggleCheck: (file: StoredFile, shiftKey: boolean) => void;
  onDragStart: (file: StoredFile) => void;
}

export default function FileListRow({
  file,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  onDragStart,
}: Props) {
  const isPublic = file.visibility === 'public';
  const thumbnail =
    previewKind(file.mimeType) === 'image'
      ? `/api/v1/files/${file.id}/download?inline=1`
      : undefined;

  return (
    <li>
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', file.id);
          onDragStart(file);
        }}
        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
          selected
            ? 'border-line-strong bg-surface shadow-[0_1px_2px_rgba(12,18,32,0.04)]'
            : 'border-transparent hover:bg-surface/70'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onToggleCheck(file, (event.nativeEvent as MouseEvent).shiftKey ?? false)
          }
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${file.name}`}
          className="h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        />

        <button
          type="button"
          onClick={() => onSelect(file)}
          aria-current={selected}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <FileMark name={file.name} mimeType={file.mimeType} thumbnailUrl={thumbnail} />

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{file.name}</span>

            <span className="tabular mt-0.5 block truncate font-mono text-xs text-ink-3">
              {formatBytes(file.size)} · {formatDate(file.createdAt)}
              {file.path && ` · ${file.path.length ? file.path.map((c) => c.name).join(' / ') : 'All files'}`}
            </span>
          </span>
        </button>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs ${
            isPublic ? 'bg-signal-soft text-signal' : 'bg-ground text-ink-3'
          }`}
        >
          {isPublic ? 'public' : 'private'}
        </span>
      </div>
    </li>
  );
}
