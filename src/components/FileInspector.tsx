'use client';

import { useEffect, useState } from 'react';
import FilePreview from '@/components/FilePreview';
import { formatBytes, formatDate } from '@/lib/format';
import { previewKind } from '@/lib/preview';
import type { StoredFile } from '@/lib/types';

interface Props {
  file: StoredFile;
  busy: boolean;
  onRename: (id: string, name: string) => Promise<void>;
  onToggleVisibility: (file: StoredFile) => Promise<void>;
  onDelete: (file: StoredFile) => void;
  onCopyLink: (file: StoredFile) => void;
  onMove: (file: StoredFile) => void;
  onClose: () => void;
}

export default function FileInspector({
  file,
  busy,
  onRename,
  onToggleVisibility,
  onDelete,
  onCopyLink,
  onMove,
  onClose,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);

  useEffect(() => {
    setDraft(file.name);
    setEditing(false);
  }, [file.id, file.name]);

  const preview = previewKind(file.mimeType);
  const isPublic = file.visibility === 'public';
  const inlineUrl = `/api/v1/files/${file.id}/download?inline=1`;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                await onRename(file.id, draft.trim());
                setEditing(false);
              }}
            >
              <input
                autoFocus
                aria-label="File name"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  setDraft(file.name);
                  setEditing(false);
                }}
                className="w-full rounded-lg border border-accent bg-surface px-2 py-1 text-sm outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Rename"
              className="block max-w-full break-words text-left font-display text-base font-bold leading-snug tracking-tight transition hover:text-accent"
            >
              {file.name}
            </button>
          )}
          <p className="mt-1 font-mono text-xs text-ink-3">{file.mimeType}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-2.5 py-1 text-[13px] font-medium transition hover:border-ink lg:hidden"
        >
          Close
        </button>
      </div>

      {preview && <FilePreview url={inlineUrl} name={file.name} kind={preview} className="h-44" />}

      <dl className="flex flex-col gap-2 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Size</dt>
          <dd className="tabular font-mono">{formatBytes(file.size)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Added</dt>
          <dd className="tabular font-mono">{formatDate(file.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Downloads</dt>
          <dd className="tabular font-mono">{file.downloadCount}</dd>
        </div>
      </dl>

      <div className="rounded-xl border border-line p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium">Anyone with the link</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
              {isPublic
                ? 'Turning this off destroys the link for good.'
                : 'Off. Only you can reach this file.'}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label="Anyone with the link"
            disabled={busy}
            onClick={() => onToggleVisibility(file)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
              isPublic ? 'bg-signal' : 'bg-line-strong'
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
                isPublic ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {file.shareUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-ground px-2.5 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-2">
              {file.shareUrl.replace(/^https?:\/\//, '')}
            </code>
            <button
              type="button"
              onClick={() => onCopyLink(file)}
              className="shrink-0 rounded-md border border-line-strong bg-surface px-2 py-1 text-[11px] font-medium transition hover:border-ink"
            >
              Copy
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <a
          href={`/api/v1/files/${file.id}/download`}
          className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-accent"
        >
          Download
        </a>
        <button
          type="button"
          onClick={() => onMove(file)}
          className="rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium transition hover:border-ink"
        >
          Move
        </button>
      </div>

      <div className="mt-auto border-t border-line pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete(file)}
          className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-danger transition hover:border-danger disabled:opacity-40"
        >
          Delete file
        </button>
      </div>
    </div>
  );
}
