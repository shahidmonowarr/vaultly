'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import ConfirmDialog from '@/components/ConfirmDialog';
import Dropzone from '@/components/Dropzone';
import FileInspector from '@/components/FileInspector';
import FileListRow from '@/components/FileListRow';
import FolderRow from '@/components/FolderRow';
import MoveDialog from '@/components/MoveDialog';
import FileCard from '@/components/FileCard';
import FolderTile from '@/components/FolderTile';
import Sidebar, { type View } from '@/components/Sidebar';
import ViewToggle, { type ViewMode } from '@/components/ViewToggle';
import SortControl from '@/components/SortControl';
import Toaster, { type Toast } from '@/components/Toaster';
import UploadList, { type UploadItem } from '@/components/UploadList';
import { api, RequestError } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { isCancelled, uploadFile } from '@/lib/upload';
import type {
  Crumb,
  FileListResponse,
  Folder,
  SessionUser,
  SortField,
  SortOrder,
  StorageUsage,
  StoredFile,
} from '@/lib/types';

type Filter = 'all' | 'private' | 'public';

const PAGE_SIZE = 20;

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<View>('files');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sharedCount, setSharedCount] = useState(0);
  const [sort, setSort] = useState<SortField>('created');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoredFile | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<Folder | null>(null);
  const [folderSummary, setFolderSummary] = useState<string>('');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [busy, setBusy] = useState(false);
  const [isWide, setIsWide] = useState(false);

  const cursors = useRef<(string | null)[]>([null]);
  const uploadCounter = useRef(0);
  const toastCounter = useRef(0);
  const dragIds = useRef<string[]>([]);
  const lastChecked = useRef<string | null>(null);
  const filePicker = useRef<HTMLInputElement>(null);

  const searching = Boolean(search);

  const pushToast = useCallback((message: string, tone: Toast['tone'] = 'neutral') => {
    toastCounter.current += 1;
    const id = toastCounter.current;
    setToasts((current) => [...current, { id, message, tone }]);
  }, []);

  const loadPage = useCallback(
    async (
      target: number,
      options: {
        search: string;
        filter: Filter;
        folderId: string | null;
        sort: SortField;
        order: SortOrder;
        view: View;
      },
    ) => {
      const browsing = options.view === 'files';

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        sort: options.view === 'recent' ? 'created' : options.sort,
        order: options.view === 'recent' ? 'desc' : options.order,
      });

      const cursor = cursors.current[target];
      if (cursor) params.set('cursor', cursor);
      if (options.search) params.set('search', options.search);

      if (options.view === 'shared') params.set('visibility', 'public');
      else if (browsing && options.filter !== 'all') params.set('visibility', options.filter);

      if (!browsing) params.set('scope', 'all');
      if (browsing && options.folderId && !options.search) params.set('folder', options.folderId);

      const [response, shared] = await Promise.all([
        api<FileListResponse>(`/api/v1/files?${params}`),
        api<FileListResponse>('/api/v1/files?limit=1&scope=all&visibility=public'),
      ]);

      setFiles(response.data);
      setFolders(response.folders);
      setBreadcrumb(response.breadcrumb);
      setNextCursor(response.pagination.nextCursor);
      setTotal(response.pagination.total);
      setStorage(response.storage);
      setSharedCount(shared.pagination.total);
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
    setChecked(new Set());
  }, [search, filter, folderId, sort, order, view]);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        loadPage(page, { search, filter, folderId, sort, order, view })
          .catch((cause) => {
            if (cause instanceof RequestError && cause.status === 401) {
              router.replace('/login');
              return;
            }
            setError(cause instanceof RequestError ? cause.message : 'Could not load your files');
          })
          .finally(() => setLoading(false));
      },
      search ? 250 : 0,
    );

    return () => clearTimeout(timer);
  }, [user, search, filter, folderId, sort, order, view, page, loadPage, router]);

  // Remembered per browser: whichever way you last looked at your files is how they
  // should look next time.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('vaultly:view-mode');
      if (saved === 'grid' || saved === 'list') setViewMode(saved);
    } catch {
      // private mode, or storage blocked; the default is fine
    }
  }, []);

  function changeViewMode(next: ViewMode) {
    setViewMode(next);
    try {
      window.localStorage.setItem('vaultly:view-mode', next);
    } catch {
      // nothing to do; the choice just will not survive a reload
    }
  }

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsWide(query.matches);

    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

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
    void loadPage(page, { search, filter, folderId, sort, order, view }).catch(() => undefined);
  }

  function goToFirstPage() {
    cursors.current = [null];
    if (page === 0) {
      refreshCurrentPage();
    } else {
      setPage(0);
    }
  }

  const handleFailure = useCallback(
    (cause: unknown, fallback: string) => {
      if (cause instanceof RequestError && cause.status === 401) {
        router.replace('/login');
        return;
      }
      pushToast(cause instanceof RequestError ? cause.message : fallback, 'danger');
    },
    [router, pushToast],
  );

  function openFolder(target: string | null) {
    setSearch('');
    setSelectedId(null);
    setView('files');
    setFolderId(target);
  }

  function changeView(next: View) {
    setSearch('');
    setSelectedId(null);
    setChecked(new Set());
    if (next === 'files') setFolderId(null);
    setView(next);
  }

  function startUploads(selected: File[]) {
    for (const file of selected) {
      uploadCounter.current += 1;
      const id = `upload-${uploadCounter.current}`;
      const destination = folderId;

      const handle = uploadFile(file, destination, (loaded) => {
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

  function toggleCheck(file: StoredFile, shiftKey: boolean) {
    setChecked((current) => {
      const next = new Set(current);

      if (shiftKey && lastChecked.current) {
        // Shift picks the run between the last box you ticked and this one.
        const from = files.findIndex((item) => item.id === lastChecked.current);
        const to = files.findIndex((item) => item.id === file.id);

        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          for (let index = start; index <= end; index += 1) next.add(files[index]!.id);
          return next;
        }
      }

      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);

      lastChecked.current = file.id;
      return next;
    });
  }

  async function moveTo(ids: string[], destination: string | null) {
    setBusy(true);
    try {
      const { data } = await api<{ data: { moved: number } }>('/api/v1/files/bulk', {
        method: 'POST',
        body: JSON.stringify({ action: 'move', ids, folderId: destination }),
      });

      pushToast(`${data.moved} ${data.moved === 1 ? 'file' : 'files'} moved`);
      setChecked(new Set());
      refreshCurrentPage();
    } catch (cause) {
      handleFailure(cause, 'Could not move those files');
    } finally {
      setBusy(false);
    }
  }

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
      refreshCurrentPage();
    } catch (cause) {
      handleFailure(cause, 'Could not change sharing');
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

      if (files.length === 1 && page > 0) setPage(page - 1);
      else refreshCurrentPage();
    } catch (cause) {
      handleFailure(cause, 'Could not delete that file');
    } finally {
      setBusy(false);
    }
  }

  async function confirmBulkDelete() {
    const ids = [...checked];
    setBulkDeleteOpen(false);
    setBusy(true);

    try {
      const { data } = await api<{ data: { deleted: number } }>('/api/v1/files/bulk', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids }),
      });

      pushToast(`${data.deleted} ${data.deleted === 1 ? 'file' : 'files'} deleted`);
      setChecked(new Set());
      goToFirstPage();
    } catch (cause) {
      handleFailure(cause, 'Could not delete those files');
    } finally {
      setBusy(false);
    }
  }

  async function createFolder() {
    const name = folderDraft.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }

    try {
      await api('/api/v1/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parentId: folderId }),
      });

      pushToast(`Folder "${name}" created`);
      setFolderDraft('');
      setCreatingFolder(false);
      refreshCurrentPage();
    } catch (cause) {
      handleFailure(cause, 'Could not create that folder');
    }
  }

  async function renameFolder(name: string) {
    const folder = renamingFolder;
    if (!folder || !name.trim()) {
      setRenamingFolder(null);
      return;
    }

    try {
      await api(`/api/v1/folders/${folder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });

      pushToast('Folder renamed');
      setRenamingFolder(null);
      refreshCurrentPage();
    } catch (cause) {
      handleFailure(cause, 'Could not rename that folder');
    }
  }

  async function askDeleteFolder(folder: Folder) {
    setPendingFolderDelete(folder);
    setFolderSummary('');

    try {
      const { data } = await api<{ data: { folders: number; files: number; bytes: number } }>(
        `/api/v1/folders/${folder.id}`,
      );

      const inner = data.folders > 0 ? `${data.folders} folders and ` : '';
      setFolderSummary(
        data.files === 0 && data.folders === 0
          ? 'It is empty.'
          : `It holds ${inner}${data.files} ${data.files === 1 ? 'file' : 'files'} (${formatBytes(data.bytes)}). All of it goes.`,
      );
    } catch {
      setFolderSummary('Everything inside it will be deleted too.');
    }
  }

  async function confirmDeleteFolder() {
    const folder = pendingFolderDelete;
    if (!folder) return;

    setPendingFolderDelete(null);
    setBusy(true);

    try {
      await api(`/api/v1/folders/${folder.id}`, { method: 'DELETE' });
      pushToast(`Folder "${folder.name}" deleted`);
      refreshCurrentPage();
    } catch (cause) {
      handleFailure(cause, 'Could not delete that folder');
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
  const filtered = searching || filter !== 'all';
  const showSkeleton = loading && files.length === 0 && folders.length === 0;
  // Only worth showing when there is somewhere to go: a next page, or a page to go back to.
  const hasOtherPages = page > 0 || Boolean(nextCursor);
  const nothingHere = files.length === 0 && folders.length === 0 && !loading;

  const viewTitle = view === 'recent' ? 'Recent' : view === 'shared' ? 'Shared' : null;

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15rem_minmax(0,1fr)]">
      <input
        ref={filePicker}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          startUploads(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />

      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">
        <Sidebar
          email={user.email}
          view={view}
          storage={storage}
          sharedCount={sharedCount}
          onChangeView={changeView}
          onUpload={() => filePicker.current?.click()}
          onSignOut={signOut}
        />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-5 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="font-display text-base font-bold tracking-tight">
          Vaultly
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => filePicker.current?.click()}
            className="rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-white"
          >
            Upload
          </button>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="min-w-0">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 pb-24 pt-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-8">
          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                {searching ? (
                  <h1 className="font-display text-xl font-bold tracking-tight">
                    Results for &ldquo;{search}&rdquo;
                  </h1>
                ) : viewTitle ? (
                  <h1 className="font-display text-xl font-bold tracking-tight">{viewTitle}</h1>
                ) : (
                  <Breadcrumbs
                    trail={breadcrumb}
                    onNavigate={openFolder}
                    onDropFiles={(target) => dragIds.current.length && moveTo(dragIds.current, target)}
                  />
                )}

                <p className="tabular mt-1 font-mono text-xs text-ink-3">
                  {total} {total === 1 ? 'file' : 'files'}
                  {view === 'shared' && total > 0 && ' reachable by anyone with the link'}
                </p>
              </div>

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search files by name"
                placeholder="Search every folder"
                className="w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent sm:w-64"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">
              {(['files', 'recent', 'shared'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeView(value)}
                  aria-pressed={view === value}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs capitalize transition ${
                    view === value ? 'bg-ink text-white' : 'bg-surface text-ink-3'
                  }`}
                >
                  {value === 'files' ? 'all files' : value}
                </button>
              ))}
            </div>

            {checked.size > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-2.5">
                <span className="tabular font-mono text-[13px] text-accent">
                  {checked.size} selected
                </span>

                <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setMoveOpen(true)}
                    className="text-[13px] font-medium text-ink-2 transition hover:text-ink disabled:opacity-40"
                  >
                    Move to
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setBulkDeleteOpen(true)}
                    className="text-[13px] font-medium text-danger transition hover:brightness-90 disabled:opacity-40"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecked(new Set())}
                    className="text-[13px] font-medium text-ink-2 transition hover:text-ink"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ViewToggle mode={viewMode} onChange={changeViewMode} />

                <SortControl
                  sort={view === 'recent' ? 'created' : sort}
                  order={view === 'recent' ? 'desc' : order}
                  onChange={(field, direction) => {
                    setView((current) => (current === 'recent' ? 'files' : current));
                    setSort(field);
                    setOrder(direction);
                  }}
                />

                {view === 'files' && (
                  <div className="flex rounded-xl border border-line bg-surface p-1">
                    {(['all', 'private', 'public'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        aria-pressed={filter === value}
                        className={`rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                          filter === value ? 'bg-ink text-white' : 'text-ink-3 hover:text-ink'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}

                {view === 'files' && !searching && (
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(true)}
                    className="ml-auto rounded-xl border border-line-strong bg-surface px-3 py-2 text-[13px] font-medium transition hover:border-ink"
                  >
                    New folder
                  </button>
                )}
              </div>
            )}

            <UploadList
              uploads={uploads}
              onDismiss={(id) => setUploads((current) => current.filter((item) => item.id !== id))}
            />

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-[#f2c8c4] bg-[#fdf2f1] px-4 py-3 text-sm text-danger"
              >
                {error}
              </p>
            )}

            {creatingFolder && (
              <div className="mt-3 rounded-xl border border-accent bg-surface px-3 py-2.5">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createFolder();
                  }}
                >
                  <input
                    autoFocus
                    value={folderDraft}
                    onChange={(event) => setFolderDraft(event.target.value)}
                    onBlur={() => void createFolder()}
                    aria-label="New folder name"
                    placeholder="Folder name"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </form>
              </div>
            )}

            {renamingFolder && (
              <div className="mt-3 rounded-xl border border-accent bg-surface px-3 py-2.5">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = new FormData(event.currentTarget).get('name');
                    void renameFolder(String(value ?? ''));
                  }}
                >
                  <input
                    autoFocus
                    name="name"
                    defaultValue={renamingFolder.name}
                    onBlur={() => setRenamingFolder(null)}
                    aria-label="Folder name"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </form>
              </div>
            )}

            {showSkeleton && (
              <ul
                className={
                  viewMode === 'grid'
                    ? 'mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'
                    : 'mt-3 flex flex-col gap-1'
                }
              >
                {Array.from({ length: viewMode === 'grid' ? 8 : 6 }, (_, index) => (
                  <li
                    key={index}
                    className={
                      viewMode === 'grid'
                        ? 'h-44 animate-pulse rounded-xl bg-line'
                        : 'flex items-center gap-3 px-3 py-2.5'
                    }
                  >
                    {viewMode === 'list' && (
                      <>
                        <span className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-line" />
                        <span className="h-3 w-44 animate-pulse rounded bg-line" />
                        <span className="ml-auto h-4 w-14 animate-pulse rounded-full bg-line" />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!showSkeleton && viewMode === 'grid' && (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {folders.map((folder) => (
                  <FolderTile
                    key={folder.id}
                    folder={folder}
                    onOpen={(picked) => openFolder(picked.id)}
                    onDropFiles={(target) => dragIds.current.length && moveTo(dragIds.current, target)}
                    onRename={setRenamingFolder}
                    onDelete={askDeleteFolder}
                  />
                ))}

                {files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    selected={file.id === selectedId}
                    checked={checked.has(file.id)}
                    onSelect={(picked) => setSelectedId(picked.id)}
                    onToggleCheck={toggleCheck}
                    onDragStart={(picked) => {
                      dragIds.current = checked.has(picked.id) ? [...checked] : [picked.id];
                    }}
                    onCopyLink={copyLink}
                    onMove={(picked) => {
                      dragIds.current = [picked.id];
                      setChecked(new Set([picked.id]));
                      setMoveOpen(true);
                    }}
                    onDelete={setPendingDelete}
                  />
                ))}
              </ul>
            )}

            {!showSkeleton && viewMode === 'list' && (
              <ul className="mt-3 flex flex-col gap-1">
                {folders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    onOpen={(picked) => openFolder(picked.id)}
                    onDropFiles={(target) => dragIds.current.length && moveTo(dragIds.current, target)}
                    onRename={setRenamingFolder}
                    onDelete={askDeleteFolder}
                  />
                ))}

                {files.map((file) => (
                  <FileListRow
                    key={file.id}
                    file={file}
                    selected={file.id === selectedId}
                    checked={checked.has(file.id)}
                    onSelect={(picked) => setSelectedId(picked.id)}
                    onToggleCheck={toggleCheck}
                    onDragStart={(picked) => {
                      dragIds.current = checked.has(picked.id) ? [...checked] : [picked.id];
                    }}
                  />
                ))}
              </ul>
            )}

            {nothingHere &&
              (filtered ? (
                <div className="mt-3 rounded-2xl border border-dashed border-line-strong px-5 py-14 text-center">
                  <p className="font-display text-lg font-semibold">Nothing matches that</p>
                  <p className="mt-1.5 text-sm text-ink-3">
                    Try a different search, or switch back to all.
                  </p>
                </div>
              ) : view === 'shared' ? (
                <div className="mt-3 rounded-2xl border border-dashed border-line-strong px-5 py-14 text-center">
                  <p className="font-display text-lg font-semibold">Nothing is shared</p>
                  <p className="mt-1.5 text-sm text-ink-3">
                    Turn on a file&rsquo;s link and it will show up here.
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <Dropzone
                    maxFileSize={storage?.maxFileSize ?? 512 * 1024 * 1024}
                    onFiles={startUploads}
                    destination={
                      breadcrumb.length ? breadcrumb[breadcrumb.length - 1]!.name : null
                    }
                  />
                </div>
              ))}

            {hasOtherPages && (
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
            } xl:sticky xl:top-6 xl:z-auto xl:block xl:overflow-visible xl:rounded-2xl xl:border xl:border-line xl:bg-surface xl:p-5`}
          >
            {selected ? (
              <FileInspector
                file={selected}
                busy={busy}
                onRename={renameFile}
                onToggleVisibility={toggleVisibility}
                onDelete={setPendingDelete}
                onCopyLink={copyLink}
                onMove={(file) => {
                  dragIds.current = [file.id];
                  setChecked(new Set([file.id]));
                  setMoveOpen(true);
                }}
                onClose={() => setSelectedId(null)}
              />
            ) : files.length > 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium">Nothing selected</p>
                <p className="mt-1 text-[13px] text-ink-3">
                  Pick a file to see its preview and share controls.
                </p>
              </div>
            ) : (
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
        </div>
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-ink/80 p-8 backdrop-blur-[3px]">
          <div className="rounded-2xl border-2 border-dashed border-white/60 px-12 py-10 text-center">
            <p className="font-display text-3xl font-bold text-white">Drop to upload</p>
            <p className="mt-2 font-mono text-[13px] text-white/70">
              {view === 'files' && breadcrumb.length
                ? `into ${breadcrumb[breadcrumb.length - 1]!.name}`
                : 'into All files'}
            </p>
          </div>
        </div>
      )}

      <MoveDialog
        open={moveOpen}
        count={checked.size}
        onMove={(destination) => {
          setMoveOpen(false);
          void moveTo([...checked], destination);
        }}
        onCancel={() => setMoveOpen(false)}
      />

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

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${checked.size} ${checked.size === 1 ? 'file' : 'files'}?`}
        body="Every link to them is destroyed as well. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      <ConfirmDialog
        open={pendingFolderDelete !== null}
        title={pendingFolderDelete ? `Delete "${pendingFolderDelete.name}"?` : ''}
        body={folderSummary || 'Checking what is inside…'}
        confirmLabel="Delete everything"
        onConfirm={confirmDeleteFolder}
        onCancel={() => setPendingFolderDelete(null)}
      />

      <Toaster
        toasts={toasts}
        onExpire={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />
    </div>
  );
}
