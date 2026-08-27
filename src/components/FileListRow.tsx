'use client';

import FileMark from '@/components/FileMark';
import { formatBytes, formatDate } from '@/lib/format';
import { previewKind } from '@/lib/preview';
import type { StoredFile } from '@/lib/types';

interface Props {
  file: StoredFile;
  selected: boolean;
  onSelect: (file: StoredFile) => void;
}

export default function FileListRow({ file, selected, onSelect }: Props) {
  const isPublic = file.visibility === 'public';
  const thumbnail =
    previewKind(file.mimeType) === 'image'
      ? `/api/v1/files/${file.id}/download?inline=1`
      : undefined;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(file)}
        aria-current={selected}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
          selected
            ? 'border-line-strong bg-surface shadow-[0_1px_2px_rgba(12,18,32,0.04)]'
            : 'border-transparent hover:bg-surface/70'
        }`}
      >
        <FileMark name={file.name} mimeType={file.mimeType} thumbnailUrl={thumbnail} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{file.name}</span>
          <span className="tabular mt-0.5 block font-mono text-xs text-ink-3">
            {formatBytes(file.size)} · {formatDate(file.createdAt)}
          </span>
        </span>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs ${
            isPublic ? 'bg-signal-soft text-signal' : 'bg-ground text-ink-3'
          }`}
        >
          {isPublic ? 'public' : 'private'}
        </span>
      </button>
    </li>
  );
}
