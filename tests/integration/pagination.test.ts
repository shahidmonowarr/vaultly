import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '@/app/api/v1/auth/register/route';
import { GET as listFiles } from '@/app/api/v1/files/route';
import { POST as completeUpload } from '@/app/api/v1/uploads/[fileId]/complete/route';
import { POST as startUpload } from '@/app/api/v1/uploads/route';
import { collectCookies, jsonRequest, params, removeUser, uniqueEmail } from '../helpers';

const email = uniqueEmail();
let cookies = '';

const NAMES = ['alpha.txt', 'bravo.txt', 'charlie.txt', 'delta.txt', 'echo.txt'];

async function upload(name: string) {
  const body = Buffer.from(`contents of ${name}`);

  const started = await startUpload(
    jsonRequest('/api/v1/uploads', {
      method: 'POST',
      cookies,
      body: { name, mimeType: 'text/plain', size: body.length },
    }),
    undefined,
  );

  const { data: ticket } = await started.json();
  const put = await fetch(ticket.parts[0].url, { method: 'PUT', body: new Uint8Array(body) });

  await completeUpload(
    jsonRequest(`/api/v1/uploads/${ticket.fileId}/complete`, {
      method: 'POST',
      cookies,
      body: { parts: [{ partNumber: 1, etag: put.headers.get('etag')!.replaceAll('"', '') }] },
    }),
    params({ fileId: ticket.fileId }),
  );
}

async function page(query: string) {
  const response = await listFiles(jsonRequest(`/api/v1/files?${query}`, { cookies }), undefined);
  return response.json();
}

beforeAll(async () => {
  const response = await register(
    jsonRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password: 'a-long-enough-password' },
    }),
    undefined,
  );

  cookies = collectCookies(response);

  // Sequential so created_at ordering is deterministic.
  for (const name of NAMES) {
    await upload(name);
  }
});

afterAll(() => removeUser(email));

describe('pagination', () => {
  it('reports the total independently of the page size', async () => {
    const body = await page('limit=2');

    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(NAMES.length);
    expect(body.pagination.nextCursor).toBeTruthy();
  });

  it('walks every file exactly once across pages', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const body = await page(`limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      seen.push(...body.data.map((file: { name: string }) => file.name));
      cursor = body.pagination.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(NAMES.length);
    expect(new Set(seen).size).toBe(NAMES.length);
    expect(seen[0]).toBe('echo.txt');
  });

  it('counts only the rows matching the active filters', async () => {
    const searched = await page('limit=10&search=alpha');

    expect(searched.pagination.total).toBe(1);
    expect(searched.data[0].name).toBe('alpha.txt');
  });

  it('returns no cursor on the final page', async () => {
    const body = await page('limit=10');

    expect(body.data).toHaveLength(NAMES.length);
    expect(body.pagination.nextCursor).toBeNull();
  });
});
