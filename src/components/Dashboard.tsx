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

const PAGE_SIZE = 10;

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keyset pagination only hands out a cursor for the next page, so the cursor that
  // opened each visited page is kept here to make backwards navigation possible.
  const cursors = useRef<(string | null)[]>([null]);
  const uploadCounter = useRef(0);

  const loadPage = useCallback(
    async (target: number, options: { search: string; filter: Filter }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      const cursor = cursors.current[target];

      if (cursor) params.set('cursor', cursor);
      if (options.search) params.set('search', options.search);
      if (options.filter !== 'all') params.set('visibility', options.filter);

      const response = await api<FileListResponse>(`/api/v1/files?${params}`);

      setFiles(response.data);
      setNextCursor(response.pagination.nextCursor);
      setTotal(response.pagination.total);
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
    cursors.current = [null];
    setPage(0);
  }, [search, filter]);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        loadPage(page, { search, filter })
          .catch((cause) =>
            setError(cause instanceof RequestError ? cause.message : 'Could not load your files'),
          )
          .finally(() => setLoading(false));
      },
      search ? 250 : 0,
    );

    return () => clearTimeout(timer);
  }, [user, search, filter, page, loadPage]);

  function refreshCurrentPage() {
    void loadPage(page, { search, filter }).catch(() => undefined);
  }

  function goToFirstPage() {
    cursors.current = [null];
    if (page === 0) {
      refreshCurrentPage();
    } else {
      setPage(0);
    }
  }

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
        {
          id,
          name: file.name,
          size: file.size,
          loaded: 0,
          status: 'uploading',
          cancel: handle.cancel,
        },
      ]);

      handle.result
        .then(() => {
          setUploads((current) => current.filter((item) => item.id !== id));
          goToFirstPage();
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

    // Removing the last row of a page would leave it empty, so step back if that happens.
    if (files.length === 1 && page > 0) {
      setPage(page - 1);
    } else {
      refreshCurrentPage();
    }
  }

  async function signOut() {
    await api('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  if (!user) {
    return <p className="p-8 text-sm text-[var(--color-muted)]">Loading…</p>;
  }

  const usedPercent = storage ? Math.min(100, (storage.used / storage.quota) * 100) : 0;
  const firstOnPage = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastOnPage = page * PAGE_SIZE + files.length;

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
        <Dropzone maxFileSize={storage?.maxFileSize ?? 512 * 1024 * 1024} onFiles={startUploads} />
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
            <div
              className="h-full rounded-full bg-[var(--color-ink)]"
              style={{ width: `${usedPercent}%` }}
            />
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

        {total > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-muted)]">
              {firstOnPage}–{lastOnPage} of {total}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0 || loading}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-medium transition hover:border-gray-300 disabled:opacity-40 disabled:hover:border-[var(--color-line)]"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!nextCursor || loading}
                onClick={() => {
                  cursors.current[page + 1] = nextCursor;
                  setPage(page + 1);
                }}
                className="rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2 text-xs font-medium transition hover:border-gray-300 disabled:opacity-40 disabled:hover:border-[var(--color-line)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
