import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '@/app/api/v1/auth/register/route';
import { DELETE as removeFile, GET as getFile, PATCH as patchFile } from '@/app/api/v1/files/[fileId]/route';
import { GET as listFiles } from '@/app/api/v1/files/route';
import { GET as getShared } from '@/app/api/v1/share/[slug]/route';
import { POST as completeUpload } from '@/app/api/v1/uploads/[fileId]/complete/route';
import { POST as startUpload } from '@/app/api/v1/uploads/route';
import { collectCookies, jsonRequest, params, removeUser, uniqueEmail } from '../helpers';

const owner = { email: uniqueEmail(), password: 'a-long-enough-password', cookies: '' };
const stranger = { email: uniqueEmail(), password: 'a-long-enough-password', cookies: '' };

async function signUp(account: typeof owner) {
  const response = await register(
    jsonRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    }),
    undefined,
  );

  account.cookies = collectCookies(response);
}

async function uploadBytes(cookies: string, name: string, contents: Buffer, declaredSize = contents.length) {
  const ticketResponse = await startUpload(
    jsonRequest('/api/v1/uploads', {
      method: 'POST',
      cookies,
      body: { name, mimeType: 'text/plain', size: declaredSize },
    }),
    undefined,
  );

  expect(ticketResponse.status).toBe(201);
  const { data: ticket } = await ticketResponse.json();

  const uploaded = await fetch(ticket.parts[0].url, { method: 'PUT', body: contents });
  expect(uploaded.ok).toBe(true);

  return completeUpload(
    jsonRequest(`/api/v1/uploads/${ticket.fileId}/complete`, {
      method: 'POST',
      cookies,
      body: { parts: [{ partNumber: 1, etag: uploaded.headers.get('etag')!.replaceAll('"', '') }] },
    }),
    params({ fileId: ticket.fileId }),
  );
}

beforeAll(async () => {
  await Promise.all([signUp(owner), signUp(stranger)]);
});

afterAll(async () => {
  await Promise.all([removeUser(owner.email), removeUser(stranger.email)]);
});

describe('upload lifecycle', () => {
  it('stores a file and lists it for its owner', async () => {
    const response = await uploadBytes(owner.cookies, 'notes.txt', Buffer.from('hello vaultly'));
    expect(response.status).toBe(200);

    const { data } = await response.json();
    expect(data.name).toBe('notes.txt');
    expect(data.size).toBe(13);
    expect(data.visibility).toBe('private');
    expect(data.shareUrl).toBeNull();

    const list = await listFiles(jsonRequest('/api/v1/files', { cookies: owner.cookies }), undefined);
    const body = await list.json();

    expect(body.data.some((file: { id: string }) => file.id === data.id)).toBe(true);
    expect(body.storage.used).toBeGreaterThan(0);
  });

  it('rejects a file whose real size differs from the size that was declared', async () => {
    const response = await uploadBytes(
      owner.cookies,
      'understated.txt',
      Buffer.from('only twenty bytes...'),
      9_000,
    );

    expect(response.status).toBe(400);
  });

  it('refuses to start an upload for an executable', async () => {
    const response = await startUpload(
      jsonRequest('/api/v1/uploads', {
        method: 'POST',
        cookies: owner.cookies,
        body: { name: 'installer.exe', mimeType: 'application/octet-stream', size: 1024 },
      }),
      undefined,
    );

    expect(response.status).toBe(415);
  });
});

describe('authorisation', () => {
  it('hides another account files behind a 404 rather than a 403', async () => {
    const created = await uploadBytes(owner.cookies, 'private.txt', Buffer.from('secret'));
    const { data } = await created.json();
    const context = params({ fileId: data.id });

    const read = await getFile(jsonRequest(`/api/v1/files/${data.id}`, { cookies: stranger.cookies }), context);
    const patch = await patchFile(
      jsonRequest(`/api/v1/files/${data.id}`, {
        method: 'PATCH',
        cookies: stranger.cookies,
        body: { visibility: 'public' },
      }),
      context,
    );
    const destroy = await removeFile(
      jsonRequest(`/api/v1/files/${data.id}`, { method: 'DELETE', cookies: stranger.cookies }),
      context,
    );

    expect([read.status, patch.status, destroy.status]).toEqual([404, 404, 404]);
  });

  it('requires a session to list files', async () => {
    const response = await listFiles(jsonRequest('/api/v1/files'), undefined);
    expect(response.status).toBe(401);
  });
});

describe('sharing', () => {
  it('publishes a link and revokes it when the file goes private again', async () => {
    const created = await uploadBytes(owner.cookies, 'shared.txt', Buffer.from('public bytes'));
    const { data } = await created.json();
    const context = params({ fileId: data.id });

    const published = await patchFile(
      jsonRequest(`/api/v1/files/${data.id}`, {
        method: 'PATCH',
        cookies: owner.cookies,
        body: { visibility: 'public' },
      }),
      context,
    );

    const { data: shared } = await published.json();
    expect(shared.shareUrl).toMatch(/\/s\/[A-Za-z0-9]{22}$/);

    const slug = shared.shareUrl.split('/').pop();
    const anonymous = await getShared(jsonRequest(`/api/v1/share/${slug}`), params({ slug }));

    expect(anonymous.status).toBe(200);
    const publicView = await anonymous.json();
    expect(publicView.data.name).toBe('shared.txt');
    expect(publicView.data.id).toBeUndefined();

    await patchFile(
      jsonRequest(`/api/v1/files/${data.id}`, {
        method: 'PATCH',
        cookies: owner.cookies,
        body: { visibility: 'private' },
      }),
      context,
    );

    const revoked = await getShared(jsonRequest(`/api/v1/share/${slug}`), params({ slug }));
    expect(revoked.status).toBe(404);
  });
});
