export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  visibility: 'private' | 'public';
  shareUrl: string | null;
  downloadCount: number;
  folderId: string | null;
  /** Only present on search results, where the folder a file sits in is the point. */
  path?: Crumb[];
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface Crumb {
  id: string;
  name: string;
}

export type SortField = 'created' | 'name' | 'size';
export type SortOrder = 'asc' | 'desc';

export interface StorageUsage {
  used: number;
  quota: number;
  maxFileSize: number;
}

export interface FileListResponse {
  data: StoredFile[];
  folders: Folder[];
  breadcrumb: Crumb[];
  pagination: { nextCursor: string | null; limit: number; total: number };
  storage: StorageUsage;
}

export interface SessionUser {
  id: string;
  email: string;
  createdAt: string;
}
