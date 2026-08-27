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
    <ul className="mt-3 space-y-2">
      {uploads.map((upload) => {
        const percent = upload.size === 0 ? 0 : Math.round((upload.loaded / upload.size) * 100);

        return (
          <li key={upload.id} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="truncate text-sm font-medium">{upload.name}</span>
              <span className="tabular shrink-0 font-mono text-[13px] text-ink-3">
                {upload.status === 'error'
                  ? 'failed'
                  : upload.status === 'finalising'
                    ? 'verifying'
                    : `${percent}% of ${formatBytes(upload.size)}`}
              </span>
            </div>

            {upload.status === 'error' ? (
              <div className="mt-2 flex items-center justify-between gap-4">
                <p className="text-[13px] text-danger">{upload.error}</p>
                <button
                  type="button"
                  onClick={() => onDismiss(upload.id)}
                  className="text-[13px] font-medium text-ink-3 hover:text-ink"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="mt-2.5 flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-ground">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200"
                    style={{ width: `${upload.status === 'finalising' ? 100 : percent}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={upload.cancel}
                  className="text-[13px] font-medium text-ink-3 hover:text-ink"
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
