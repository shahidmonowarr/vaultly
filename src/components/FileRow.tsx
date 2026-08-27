'use client';

import { useState } from 'react';
import FilePreview from '@/components/FilePreview';
import { formatBytes, formatDate } from '@/lib/format';
import { previewKind } from '@/lib/preview';
import type { StoredFile } from '@/lib/types';

interface Props {
  file: StoredFile;
  onRename: (id: string, name: string) => Promise<void>;
  onToggleVisibility: (file: StoredFile) => Promise<void>;
  onDelete: (file: StoredFile) => Promise<void>;
}

const action = 'text-[13px] font-medium text-ink-3 transition hover:text-ink disabled:opacity-40';

export default function FileRow({ file, onRename, onToggleVisibility, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const preview = previewKind(file.mimeType);
  const isPublic = file.visibility === 'public';

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!file.shareUrl) return;

    await navigator.clipboard.writeText(file.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <li className="px-4 py-3 transition-colors hover:bg-[#f7f9fc] sm:px-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_5rem_16.5rem]">
        <div className="min-w-0">
          {editing ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                await run(() => onRename(file.id, draft.trim()));
                setEditing(false);
              }}
            >
              <input
                autoFocus
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
              className="block max-w-full truncate text-left text-sm font-medium transition hover:text-accent"
            >
              {file.name}
            </button>
          )}

          <p className="tabular mt-1 font-mono text-xs text-ink-3 sm:hidden">
            {formatBytes(file.size)} · {formatDate(file.createdAt)}
          </p>
        </div>

        <p className="tabular hidden font-mono text-[13px] text-ink-2 sm:block">
          {formatBytes(file.size)}
        </p>

        <p className="tabular hidden font-mono text-[13px] text-ink-3 sm:block">
          {formatDate(file.createdAt)}
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => onToggleVisibility(file))}
          title={isPublic ? 'Make private and kill the link' : 'Publish a share link'}
          className={`justify-self-start rounded-full px-2.5 py-1 font-mono text-xs transition disabled:opacity-50 ${
            isPublic
              ? 'bg-signal-soft text-signal hover:brightness-95'
              : 'bg-ground text-ink-3 hover:text-ink'
          }`}
        >
          {isPublic ? 'public' : 'private'}
        </button>

        <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-1 sm:justify-end">
          {preview && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              aria-expanded={showPreview}
              className={action}
            >
              {showPreview ? 'Hide' : 'Preview'}
            </button>
          )}

          {file.shareUrl && (
            <button type="button" onClick={copyLink} className={action}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          )}

          <a href={`/api/v1/files/${file.id}/download`} className={action}>
            Download
          </a>

          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onDelete(file))}
            className="text-[13px] font-medium text-danger transition hover:brightness-90 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {preview && showPreview && (
        <div className="mt-3">
          <FilePreview
            url={`/api/v1/files/${file.id}/download?inline=1`}
            name={file.name}
            kind={preview}
            className="h-80"
          />
        </div>
      )}
    </li>
  );
}
