'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import Dropzone from '@/components/Dropzone';
import FileInspector from '@/components/FileInspector';
import FileListRow from '@/components/FileListRow';
import Toaster, { type Toast } from '@/components/Toaster';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [publicCount, setPublicCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoredFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [isWide, setIsWide] = useState(false);

  // Keyset pagination only hands out a cursor for the next page, so the cursor that
  // opened each visited page is kept here to make backwards navigation possible.
  const cursors = useRef<(string | null)[]>([null]);
  const uploadCounter = useRef(0);
  const toastCounter = useRef(0);

  const pushToast = useCallback((message: string, tone: Toast['tone'] = 'neutral') => {
    toastCounter.current += 1;
    const id = toastCounter.current;
    setToasts((current) => [...current, { id, message, tone }]);
  }, []);

  const loadPage = useCallback(
    async (target: number, options: { search: string; filter: Filter }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      const cursor = cursors.current[target];

      if (cursor) params.set('cursor', cursor);
      if (options.search) params.set('search', options.search);
      if (options.filter !== 'all') params.set('visibility', options.filter);

      const [listed, shared] = await Promise.all([
        api<FileListResponse>(`/api/v1/files?${params}`),
        api<FileListResponse>('/api/v1/files?limit=1&visibility=public'),
      ]);

      setFiles(listed.data);
      setNextCursor(listed.pagination.nextCursor);
      setTotal(listed.pagination.total);
      setStorage(listed.storage);
      setPublicCount(shared.pagination.total);
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

  // The inspector is a side panel on a wide screen and a full screen sheet on a narrow
  // one, so auto-selecting would hide the list behind a detail view on a phone.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsWide(query.matches);

    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Keep a selection that still exists; only fall back to the first file on a wide screen,
  // where the panel would otherwise sit empty beside a full list.
  useEffect(() => {
    if (files.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) => {
      if (current && files.some((file) => file.id === current)) return current;
      return isWide ? files[0]!.id : null;
    });
  }, [files, isWide]);

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
        .then((stored) => {
          setUploads((current) => current.filter((item) => item.id !== id));
          if (isWide) setSelectedId(stored.id);
          pushToast(`${stored.name} uploaded`);
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

  // Dropping anywhere on the page uploads, which is what people try first. The ref keeps
  // the listeners stable while still calling the current handler.
  const dropHandler = useRef(startUploads);
  dropHandler.current = startUploads;

  useEffect(() => {
    let depth = 0;
    const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files');

    const onEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth += 1;
      setDragging(true);
    };

    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };

    const onOver = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);

      const dropped = Array.from(event.dataTransfer?.files ?? []);
      if (dropped.length > 0) dropHandler.current(dropped);
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  async function renameFile(id: string, name: string) {
    if (!name) return;

    const { data } = await api<{ data: StoredFile }>(`/api/v1/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });

    setFiles((current) => current.map((file) => (file.id === id ? data : file)));
    pushToast('Renamed');
  }

  async function toggleVisibility(file: StoredFile) {
    setBusy(true);
    try {
      const visibility = file.visibility === 'public' ? 'private' : 'public';

      const { data } = await api<{ data: StoredFile }>(`/api/v1/files/${file.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ visibility }),
      });

      setFiles((current) => current.map((item) => (item.id === file.id ? data : item)));
      pushToast(visibility === 'public' ? 'Share link created' : 'Share link revoked');

      // The file may no longer belong in the active filter, and the counts in the header
      // are now stale either way, so re-read the page rather than patching them by hand.
      refreshCurrentPage();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(file: StoredFile) {
    if (!file.shareUrl) return;

    try {
      await navigator.clipboard.writeText(file.shareUrl);
      pushToast('Share link copied');
    } catch {
      pushToast('Could not reach the clipboard', 'danger');
    }
  }

  async function confirmDelete() {
    const file = pendingDelete;
    if (!file) return;

    setPendingDelete(null);
    setBusy(true);

    try {
      await api(`/api/v1/files/${file.id}`, { method: 'DELETE' });
      pushToast(`${file.name} deleted`);

      // Removing the last row of a page would leave it empty, so step back if that happens.
      if (files.length === 1 && page > 0) {
        setPage(page - 1);
      } else {
        refreshCurrentPage();
      }
    } catch (cause) {
      pushToast(cause instanceof RequestError ? cause.message : 'Could not delete that file', 'danger');
    } finally {
      setBusy(false);
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

  const selected = files.find((file) => file.id === selectedId) ?? null;
  const usedPercent = storage ? Math.min(100, (storage.used / storage.quota) * 100) : 0;
  const firstOnPage = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastOnPage = page * PAGE_SIZE + files.length;
  const filtered = Boolean(search) || filter !== 'all';
  const showSkeleton = loading && files.length === 0;
  const showPanel = files.length > 0;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              className="font-display text-base font-bold tracking-tight transition hover:text-accent"
            >
              Vaultly
            </Link>
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

      <main className="mx-auto grid max-w-6xl gap-8 px-5 pb-24 pt-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Your files</h1>
              <p className="tabular mt-1 font-mono text-xs text-ink-3">
                {total} {total === 1 ? 'file' : 'files'}
                {storage && ` · ${formatBytes(storage.used)} of ${formatBytes(storage.quota)}`}
                {` · ${publicCount} shared`}
              </p>
            </div>

            <div className="w-28">
              <div className="h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-ink" style={{ width: `${usedPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Dropzone
              maxFileSize={storage?.maxFileSize ?? 512 * 1024 * 1024}
              onFiles={startUploads}
            />
            <UploadList
              uploads={uploads}
              onDismiss={(id) => setUploads((current) => current.filter((item) => item.id !== id))}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
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

          <ul className="mt-3 flex flex-col gap-1">
            {showSkeleton &&
              Array.from({ length: 5 }, (_, index) => (
                <li key={index} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-line" />
                  <span className="h-3 w-44 animate-pulse rounded bg-line" />
                  <span className="ml-auto h-4 w-14 animate-pulse rounded-full bg-line" />
                </li>
              ))}

            {!showSkeleton &&
              files.map((file) => (
                <FileListRow
                  key={file.id}
                  file={file}
                  selected={file.id === selectedId}
                  onSelect={(picked) => setSelectedId(picked.id)}
                />
              ))}
          </ul>

          {files.length === 0 && !loading && (
            <div className="mt-3 rounded-2xl border border-dashed border-line-strong px-5 py-14 text-center">
              <p className="font-display text-lg font-semibold">
                {filtered ? 'Nothing matches those filters' : 'No files yet'}
              </p>
              <p className="mt-1.5 text-sm text-ink-3">
                {filtered
                  ? 'Try a different search, or switch back to all.'
                  : 'Drop a file anywhere on this page. It stays private until you publish a link.'}
              </p>
            </div>
          )}

          {total > 0 && (
            <div className="mt-5 flex items-center justify-between gap-3">
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
        </section>

        <aside
          className={`${
            selected ? 'fixed inset-0 z-40 overflow-y-auto bg-surface p-5' : 'hidden'
          } lg:sticky lg:top-24 lg:z-auto lg:block lg:overflow-visible lg:rounded-2xl lg:border lg:border-line lg:bg-surface lg:p-5`}
        >
          {selected ? (
            <FileInspector
              file={selected}
              busy={busy}
              onRename={renameFile}
              onToggleVisibility={toggleVisibility}
              onDelete={setPendingDelete}
              onCopyLink={copyLink}
              onClose={() => setSelectedId(null)}
            />
          ) : showPanel ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium">Nothing selected</p>
              <p className="mt-1 text-[13px] text-ink-3">
                Pick a file to see its preview and share controls.
              </p>
            </div>
          ) : (
            // With no files at all the panel still holds its column, so the page does not
            // reflow the moment the last file goes. It explains itself rather than sitting blank.
            <div className="flex flex-col gap-3 py-6">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                File details
              </p>
              <p className="text-[13px] leading-relaxed text-ink-2">
                Select a file and its preview, size, share link and download all appear here.
              </p>
              <p className="text-[13px] leading-relaxed text-ink-3">
                Everything you upload starts private. A file is only reachable by anyone else
                once you turn its link on, and turning it off destroys that link for good.
              </p>
            </div>
          )}
        </aside>
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-ink/80 p-8 backdrop-blur-[3px]">
          <div className="rounded-2xl border-2 border-dashed border-white/60 px-12 py-10 text-center">
            <p className="font-display text-3xl font-bold text-white">Drop to upload</p>
            <p className="mt-2 font-mono text-[13px] text-white/70">
              straight to storage, in parallel parts
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this file?"
        body={
          pendingDelete
            ? `${pendingDelete.name} and any link to it are removed for good. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Toaster
        toasts={toasts}
        onExpire={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />
    </div>
  );
}
