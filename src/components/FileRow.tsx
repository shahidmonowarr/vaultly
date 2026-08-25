'use client';

import { useState } from 'react';
import { formatBytes, formatDate } from '@/lib/format';
import type { StoredFile } from '@/lib/types';

interface Props {
  file: StoredFile;
  onRename: (id: string, name: string) => Promise<void>;
  onToggleVisibility: (file: StoredFile) => Promise<void>;
  onDelete: (file: StoredFile) => Promise<void>;
}

export default function FileRow({ file, onRename, onToggleVisibility, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
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
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
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
              className="w-full rounded-md border border-[var(--color-accent)] px-2 py-1 text-sm outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="block max-w-full truncate text-left text-sm font-medium hover:text-[var(--color-accent)]"
          >
            {file.name}
          </button>
        )}

        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          {formatBytes(file.size)} · {formatDate(file.createdAt)}
          {file.downloadCount > 0 && ` · ${file.downloadCount} downloads`}
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => onToggleVisibility(file))}
        className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
          file.visibility === 'public'
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {file.visibility === 'public' ? 'Public' : 'Private'}
      </button>

      <div className="flex items-center gap-3 text-xs font-medium">
        {file.shareUrl && (
          <button type="button" onClick={copyLink} className="hover:text-[var(--color-accent)]">
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}

        <a
          href={`/api/v1/files/${file.id}/download`}
          className="hover:text-[var(--color-accent)]"
        >
          Download
        </a>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => onDelete(file))}
          className="text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
