export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  visibility: 'private' | 'public';
  shareUrl: string | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageUsage {
  used: number;
  quota: number;
  maxFileSize: number;
}

export interface FileListResponse {
  data: StoredFile[];
  pagination: { nextCursor: string | null; limit: number; total: number };
  storage: StorageUsage;
}

export interface SessionUser {
  id: string;
  email: string;
  createdAt: string;
}
