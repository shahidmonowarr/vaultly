import { api } from './api';
import type { StoredFile } from './types';

interface UploadTicket {
  fileId: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
}

const MAX_CONCURRENT_PARTS = 3;
const MAX_ATTEMPTS = 3;

export interface UploadHandle {
  result: Promise<StoredFile>;
  cancel: () => void;
}

class UploadCancelled extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelled';
  }
}

export function isCancelled(error: unknown) {
  return error instanceof Error && error.name === 'UploadCancelled';
}

function putPart(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url, true);

    request.upload.addEventListener('progress', (event) => onProgress(event.loaded));

    request.addEventListener('load', () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Storage rejected the part with status ${request.status}`));
        return;
      }

      // Completing a multipart upload requires the ETag of every part, which is why
      // the bucket CORS policy has to expose that header.
      const etag = request.getResponseHeader('ETag');
      if (!etag) {
        reject(new Error('Storage did not return an ETag for the uploaded part'));
        return;
      }

      resolve(etag.replaceAll('"', ''));
    });

    request.addEventListener('error', () => reject(new Error('Network error while uploading')));
    request.addEventListener('abort', () => reject(new UploadCancelled()));

    signal.addEventListener('abort', () => request.abort(), { once: true });
    request.send(body);
  });
}

async function putPartWithRetry(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await putPart(url, body, signal, onProgress);
    } catch (error) {
      if (error instanceof UploadCancelled) throw error;

      lastError = error;
      onProgress(0);
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
    }
  }

  throw lastError;
}

export function uploadFile(file: File, onProgress: (loaded: number) => void): UploadHandle {
  const controller = new AbortController();

  const result = (async () => {
    const { data: ticket } = await api<{ data: UploadTicket }>('/api/v1/uploads', {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    });

    const loadedPerPart = new Array<number>(ticket.parts.length).fill(0);
    const etags = new Array<string>(ticket.parts.length);
    let cursor = 0;

    const report = () => onProgress(loadedPerPart.reduce((total, value) => total + value, 0));

    const worker = async () => {
      while (cursor < ticket.parts.length) {
        const index = cursor;
        cursor += 1;

        const part = ticket.parts[index]!;
        const start = index * ticket.partSize;
        const chunk = file.slice(start, Math.min(start + ticket.partSize, file.size));

        etags[index] = await putPartWithRetry(part.url, chunk, controller.signal, (loaded) => {
          loadedPerPart[index] = loaded;
          report();
        });
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENT_PARTS, ticket.parts.length) }, worker),
      );

      const { data } = await api<{ data: StoredFile }>(
        `/api/v1/uploads/${ticket.fileId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            parts: ticket.parts.map((part, index) => ({
              partNumber: part.partNumber,
              etag: etags[index],
            })),
          }),
        },
      );

      return data;
    } catch (error) {
      // Leaving a half-finished multipart upload behind would keep billing for storage
      // nobody can see, so release it before surfacing the failure.
      await api(`/api/v1/uploads/${ticket.fileId}`, { method: 'DELETE' }).catch(() => undefined);
      throw error;
    }
  })();

  return { result, cancel: () => controller.abort() };
}
