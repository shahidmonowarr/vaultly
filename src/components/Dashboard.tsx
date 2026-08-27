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
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="font-mono text-[13px] text-ink-3">loading your files</p>
      </div>
    );
  }

  const usedPercent = storage ? Math.min(100, (storage.used / storage.quota) * 100) : 0;
  const firstOnPage = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastOnPage = page * PAGE_SIZE + files.length;
  const filtered = Boolean(search) || filter !== 'all';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-base font-bold tracking-tight">Vaultly</span>
            <span className="hidden truncate font-mono text-xs text-ink-3 sm:block">
              {user.email}
            </span>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium transition hover:border-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-7">
        <Dropzone maxFileSize={storage?.maxFileSize ?? 512 * 1024 * 1024} onFiles={startUploads} />
        <UploadList
          uploads={uploads}
          onDismiss={(id) => setUploads((current) => current.filter((item) => item.id !== id))}
        />

        {storage && (
          <div className="mt-6 flex items-center gap-3">
            <div className="h-1 w-32 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-ink" style={{ width: `${usedPercent}%` }} />
            </div>
            <span className="tabular font-mono text-xs text-ink-3">
              {formatBytes(storage.used)} of {formatBytes(storage.quota)}
            </span>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent"
          />

          <div className="flex rounded-xl border border-line bg-surface p-1">
            {(['all', 'private', 'public'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                  filter === value ? 'bg-ink text-white' : 'text-ink-3 hover:text-ink'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-[#f2c8c4] bg-[#fdf2f1] px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          {files.length > 0 && (
            <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_5rem_16.5rem] gap-x-4 border-b border-line px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-3 sm:grid">
              <span>Name</span>
              <span>Size</span>
              <span>Added</span>
              <span>Visibility</span>
              <span className="sr-only">Actions</span>
            </div>
          )}

          <ul className="divide-y divide-line">
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
              <li className="px-5 py-16 text-center">
                <p className="font-display text-lg font-semibold">
                  {filtered ? 'Nothing matches those filters' : 'No files yet'}
                </p>
                <p className="mt-1.5 text-sm text-ink-3">
                  {filtered
                    ? 'Try a different search, or switch back to all.'
                    : 'Drop one above. It stays private until you publish a link.'}
                </p>
              </li>
            )}
          </ul>
        </section>

        {total > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="tabular font-mono text-xs text-ink-3">
              {firstOnPage}–{lastOnPage} of {total}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0 || loading}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-medium transition hover:border-ink disabled:opacity-40 disabled:hover:border-line"
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
                className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-medium transition hover:border-ink disabled:opacity-40 disabled:hover:border-line"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
