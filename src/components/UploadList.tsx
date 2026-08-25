'use client';

import { formatBytes } from '@/lib/format';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  loaded: number;
  status: 'uploading' | 'finalising' | 'error';
  error?: string;
  cancel: () => void;
}

export default function UploadList({
  uploads,
  onDismiss,
}: {
  uploads: UploadItem[];
  onDismiss: (id: string) => void;
}) {
  if (uploads.length === 0) return null;

  return (
    <ul className="mt-4 space-y-2">
      {uploads.map((upload) => {
        const percent = upload.size === 0 ? 0 : Math.round((upload.loaded / upload.size) * 100);

        return (
          <li
            key={upload.id}
            className="rounded-xl border border-[var(--color-line)] bg-white px-4 py-3"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="truncate text-sm font-medium">{upload.name}</span>
              <span className="shrink-0 text-xs text-[var(--color-muted)]">
                {upload.status === 'error'
                  ? 'Failed'
                  : upload.status === 'finalising'
                    ? 'Finalising…'
                    : `${percent}% of ${formatBytes(upload.size)}`}
              </span>
            </div>

            {upload.status === 'error' ? (
              <div className="mt-2 flex items-center justify-between gap-4">
                <p className="text-xs text-red-600">{upload.error}</p>
                <button
                  type="button"
                  onClick={() => onDismiss(upload.id)}
                  className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200"
                    style={{ width: `${upload.status === 'finalising' ? 100 : percent}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={upload.cancel}
                  className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                >
                  Cancel
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
