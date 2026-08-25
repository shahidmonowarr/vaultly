'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dropzone from '@/components/Dropzone';
import FileRow from '@/components/FileRow';
import UploadList, { type UploadItem } from '@/components/UploadList';
import { api, RequestError } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { isCancelled, uploadFile } from '@/lib/upload';
import type { FileListResponse, SessionUser, StorageUsage, StoredFile } from '@/lib/types';

type Filter = 'all' | 'private' | 'public';

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uploadCounter = useRef(0);

  const loadFiles = useCallback(
    async (options: { cursor?: string; search: string; filter: Filter }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (options.cursor) params.set('cursor', options.cursor);
      if (options.search) params.set('search', options.search);
      if (options.filter !== 'all') params.set('visibility', options.filter);

      const response = await api<FileListResponse>(`/api/v1/files?${params}`);

      setFiles((current) => (options.cursor ? [...current, ...response.data] : response.data));
      setNextCursor(response.pagination.nextCursor);
      setStorage(response.storage);
    },
    [],
  );

  useEffect(() => {
    api<{ user: SessionUser }>('/api/v1/auth/me')
      .then((response) => setUser(response.user))
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      setLoading(true);
      loadFiles({ search, filter })
        .catch((cause) =>
          setError(cause instanceof RequestError ? cause.message : 'Could not load your files'),
        )
        .finally(() => setLoading(false));
    }, search ? 250 : 0);

    return () => clearTimeout(timer);
  }, [user, search, filter, loadFiles]);

  function startUploads(selected: File[]) {
    for (const file of selected) {
      uploadCounter.current += 1;
      const id = `upload-${uploadCounter.current}`;

      const handle = uploadFile(file, (loaded) => {
        setUploads((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, loaded, status: loaded >= file.size ? 'finalising' : 'uploading' }
              : item,
          ),
        );
      });

      setUploads((current) => [
        ...current,
        { id, name: file.name, size: file.size, loaded: 0, status: 'uploading', cancel: handle.cancel },
      ]);

      handle.result
        .then((stored) => {
          setUploads((current) => current.filter((item) => item.id !== id));
          setFiles((current) => [stored, ...current]);
          void loadFiles({ search, filter });
        })
        .catch((cause) => {
          if (isCancelled(cause)) {
            setUploads((current) => current.filter((item) => item.id !== id));
            return;
          }

          setUploads((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: 'error',
                    error: cause instanceof RequestError ? cause.message : 'Upload failed',
                  }
                : item,
            ),
          );
        });
    }
  }

  async function renameFile(id: string, name: string) {
    if (!name) return;

    const { data } = await api<{ data: StoredFile }>(`/api/v1/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });

    setFiles((current) => current.map((file) => (file.id === id ? data : file)));
  }

  async function toggleVisibility(file: StoredFile) {
    const visibility = file.visibility === 'public' ? 'private' : 'public';

    const { data } = await api<{ data: StoredFile }>(`/api/v1/files/${file.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    });

    setFiles((current) => current.map((item) => (item.id === file.id ? data : item)));
  }

  async function deleteFile(file: StoredFile) {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return;

    await api(`/api/v1/files/${file.id}`, { method: 'DELETE' });
    setFiles((current) => current.filter((item) => item.id !== file.id));
    setStorage((current) => (current ? { ...current, used: current.used - file.size } : current));
  }

  async function signOut() {
    await api('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  if (!user) {
    return <p className="p-8 text-sm text-[var(--color-muted)]">Loading…</p>;
  }

  const usedPercent = storage ? Math.min(100, (storage.used / storage.quota) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-accent)]">Vaultly</p>
          <p className="text-xs text-[var(--color-muted)]">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2 text-sm font-medium transition hover:border-gray-300"
        >
          Sign out
        </button>
      </header>

      <section className="mt-8">
        <Dropzone
          maxFileSize={storage?.maxFileSize ?? 512 * 1024 * 1024}
          onFiles={startUploads}
        />
        <UploadList
          uploads={uploads}
          onDismiss={(id) => setUploads((current) => current.filter((item) => item.id !== id))}
        />
      </section>

      {storage && (
        <section className="mt-8">
          <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
            <span>
              {formatBytes(storage.used)} of {formatBytes(storage.quota)} used
            </span>
            <span>{Math.round(usedPercent)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-[var(--color-ink)]" style={{ width: `${usedPercent}%` }} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files"
            className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <div className="flex rounded-lg border border-[var(--color-line)] bg-white p-0.5">
            {(['all', 'private', 'public'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  filter === value ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-muted)]'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <ul className="mt-4 divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white">
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              onRename={renameFile}
              onToggleVisibility={toggleVisibility}
              onDelete={deleteFile}
            />
          ))}

          {files.length === 0 && !loading && (
            <li className="px-4 py-12 text-center text-sm text-[var(--color-muted)]">
              {search || filter !== 'all'
                ? 'Nothing matches those filters.'
                : 'No files yet. Drop one above to get started.'}
            </li>
          )}
        </ul>

        {nextCursor && (
          <button
            type="button"
            onClick={() => loadFiles({ cursor: nextCursor, search, filter })}
            className="mt-4 w-full rounded-lg border border-[var(--color-line)] bg-white py-2.5 text-sm font-medium transition hover:border-gray-300"
          >
            Load more
          </button>
        )}
      </section>
    </div>
  );
}
