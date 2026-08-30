import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as register } from '@/app/api/v1/auth/register/route';
import { POST as bulk } from '@/app/api/v1/files/bulk/route';
import { GET as listFiles } from '@/app/api/v1/files/route';
import { PATCH as patchFile } from '@/app/api/v1/files/[fileId]/route';
import {
  DELETE as removeFolder,
  GET as folderInfo,
  PATCH as patchFolder,
} from '@/app/api/v1/folders/[folderId]/route';
import { POST as createFolder } from '@/app/api/v1/folders/route';
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

async function makeFolder(cookies: string, name: string, parentId: string | null = null) {
  return createFolder(
    jsonRequest('/api/v1/folders', { method: 'POST', cookies, body: { name, parentId } }),
    undefined,
  );
}

async function upload(cookies: string, name: string, bytes: Buffer, folderId: string | null) {
  const started = await startUpload(
    jsonRequest('/api/v1/uploads', {
      method: 'POST',
      cookies,
      body: { name, mimeType: 'text/plain', size: bytes.length, folderId },
    }),
    undefined,
  );

  const { data: ticket } = await started.json();
  const put = await fetch(ticket.parts[0].url, { method: 'PUT', body: new Uint8Array(bytes) });

  const done = await completeUpload(
    jsonRequest(`/api/v1/uploads/${ticket.fileId}/complete`, {
      method: 'POST',
      cookies,
      body: { parts: [{ partNumber: 1, etag: put.headers.get('etag')!.replaceAll('"', '') }] },
    }),
    params({ fileId: ticket.fileId }),
  );

  return (await done.json()).data;
}

async function browse(cookies: string, query = '') {
  const response = await listFiles(jsonRequest(`/api/v1/files?${query}`, { cookies }), undefined);
  return response.json();
}

beforeAll(async () => {
  await Promise.all([signUp(owner), signUp(stranger)]);
});

afterAll(async () => {
  await Promise.all([removeUser(owner.email), removeUser(stranger.email)]);
});

describe('folders', () => {
  it('refuses two folders with the same name beside each other', async () => {
    const first = await makeFolder(owner.cookies, 'Invoices');
    expect(first.status).toBe(201);

    const again = await makeFolder(owner.cookies, 'invoices');
    expect(again.status).toBe(409);
  });

  it('allows the same name inside a different parent', async () => {
    const { data: parent } = await (await makeFolder(owner.cookies, 'Clients')).json();
    const nested = await makeFolder(owner.cookies, 'Invoices', parent.id);

    expect(nested.status).toBe(201);
  });

  it('reports the trail from the root to the current folder', async () => {
    const { data: top } = await (await makeFolder(owner.cookies, 'Archive')).json();
    const { data: year } = await (await makeFolder(owner.cookies, '2026', top.id)).json();
    const { data: month } = await (await makeFolder(owner.cookies, 'March', year.id)).json();

    const page = await browse(owner.cookies, `folder=${month.id}`);

    expect(page.breadcrumb.map((crumb: { name: string }) => crumb.name)).toEqual([
      'Archive',
      '2026',
      'March',
    ]);
  });

  it('will not move a folder inside its own subtree', async () => {
    const { data: outer } = await (await makeFolder(owner.cookies, 'Projects')).json();
    const { data: inner } = await (await makeFolder(owner.cookies, 'Alpha', outer.id)).json();

    const response = await patchFolder(
      jsonRequest(`/api/v1/folders/${outer.id}`, {
        method: 'PATCH',
        cookies: owner.cookies,
        body: { parentId: inner.id },
      }),
      params({ folderId: outer.id }),
    );

    expect(response.status).toBe(400);
  });

  it('will not move a folder into itself', async () => {
    const { data: folder } = await (await makeFolder(owner.cookies, 'Loop')).json();

    const response = await patchFolder(
      jsonRequest(`/api/v1/folders/${folder.id}`, {
        method: 'PATCH',
        cookies: owner.cookies,
        body: { parentId: folder.id },
      }),
      params({ folderId: folder.id }),
    );

    expect(response.status).toBe(400);
  });

  it('hides another account folder behind a 404', async () => {
    const { data: mine } = await (await makeFolder(owner.cookies, 'Private plans')).json();

    const response = await patchFolder(
      jsonRequest(`/api/v1/folders/${mine.id}`, {
        method: 'PATCH',
        cookies: stranger.cookies,
        body: { name: 'taken' },
      }),
      params({ folderId: mine.id }),
    );

    expect(response.status).toBe(404);
  });
});

describe('files inside folders', () => {
  it('lists a file in its folder and not at the root', async () => {
    const { data: folder } = await (await makeFolder(owner.cookies, 'Reports')).json();
    const file = await upload(owner.cookies, 'q1.txt', Buffer.from('q1'), folder.id);

    const inFolder = await browse(owner.cookies, `folder=${folder.id}`);
    const atRoot = await browse(owner.cookies, '');

    expect(inFolder.data.map((f: { id: string }) => f.id)).toContain(file.id);
    expect(atRoot.data.map((f: { id: string }) => f.id)).not.toContain(file.id);
  });

  it('searches across every folder and says where each result lives', async () => {
    const { data: folder } = await (await makeFolder(owner.cookies, 'Deep')).json();
    const { data: nested } = await (await makeFolder(owner.cookies, 'Deeper', folder.id)).json();
    await upload(owner.cookies, 'needle-in-haystack.txt', Buffer.from('x'), nested.id);

    const results = await browse(owner.cookies, 'search=needle-in-haystack');
    const hit = results.data.find((f: { name: string }) => f.name === 'needle-in-haystack.txt');

    expect(hit).toBeTruthy();
    expect(hit.path.map((crumb: { name: string }) => crumb.name)).toEqual(['Deep', 'Deeper']);
  });

  it('moves a file into a folder through the patch endpoint', async () => {
    const { data: folder } = await (await makeFolder(owner.cookies, 'Moved')).json();
    const file = await upload(owner.cookies, 'wanderer.txt', Buffer.from('x'), null);

    const response = await patchFile(
      jsonRequest(`/api/v1/files/${file.id}`, {
        method: 'PATCH',
        cookies: owner.cookies,
        body: { folderId: folder.id },
      }),
      params({ fileId: file.id }),
    );

    expect((await response.json()).data.folderId).toBe(folder.id);
  });

  it('takes every file with it when a folder is deleted', async () => {
    const { data: folder } = await (await makeFolder(owner.cookies, 'Doomed')).json();
    const { data: child } = await (await makeFolder(owner.cookies, 'Also doomed', folder.id)).json();
    const one = await upload(owner.cookies, 'goes-away.txt', Buffer.from('x'), folder.id);
    const two = await upload(owner.cookies, 'goes-too.txt', Buffer.from('x'), child.id);

    const summary = await folderInfo(
      jsonRequest(`/api/v1/folders/${folder.id}`, { cookies: owner.cookies }),
      params({ folderId: folder.id }),
    );
    expect((await summary.json()).data.files).toBe(2);

    const removed = await removeFolder(
      jsonRequest(`/api/v1/folders/${folder.id}`, { method: 'DELETE', cookies: owner.cookies }),
      params({ folderId: folder.id }),
    );
    expect(removed.status).toBe(200);

    const everything = await browse(owner.cookies, 'search=goes-');
    const names = everything.data.map((f: { id: string }) => f.id);

    expect(names).not.toContain(one.id);
    expect(names).not.toContain(two.id);
  });
});

describe('bulk actions and sorting', () => {
  it('moves and then deletes several files at once', async () => {
    const { data: folder } = await (await makeFolder(owner.cookies, 'Batch')).json();
    const made = [];
    for (const name of ['batch-a.txt', 'batch-b.txt', 'batch-c.txt']) {
      made.push(await upload(owner.cookies, name, Buffer.from(name), null));
    }

    const ids = made.map((file) => file.id);

    const moved = await bulk(
      jsonRequest('/api/v1/files/bulk', {
        method: 'POST',
        cookies: owner.cookies,
        body: { action: 'move', ids, folderId: folder.id },
      }),
      undefined,
    );
    expect((await moved.json()).data.moved).toBe(3);

    const inFolder = await browse(owner.cookies, `folder=${folder.id}`);
    expect(inFolder.pagination.total).toBe(3);

    const deleted = await bulk(
      jsonRequest('/api/v1/files/bulk', {
        method: 'POST',
        cookies: owner.cookies,
        body: { action: 'delete', ids },
      }),
      undefined,
    );
    expect((await deleted.json()).data.deleted).toBe(3);

    const after = await browse(owner.cookies, `folder=${folder.id}`);
    expect(after.pagination.total).toBe(0);
  });

  it('ignores ids belonging to another account', async () => {
    const mine = await upload(owner.cookies, 'not-yours.txt', Buffer.from('x'), null);

    const response = await bulk(
      jsonRequest('/api/v1/files/bulk', {
        method: 'POST',
        cookies: stranger.cookies,
        body: { action: 'delete', ids: [mine.id] },
      }),
      undefined,
    );

    expect((await response.json()).data.deleted).toBe(0);
  });

  it('sorts by name in both directions', async () => {
    const { data: folder } = await (await makeFolder(owner.cookies, 'Sorted')).json();
    for (const name of ['cherry.txt', 'apple.txt', 'banana.txt']) {
      await upload(owner.cookies, name, Buffer.from(name), folder.id);
    }

    const ascending = await browse(owner.cookies, `folder=${folder.id}&sort=name&order=asc`);
    const descending = await browse(owner.cookies, `folder=${folder.id}&sort=name&order=desc`);

    expect(ascending.data.map((f: { name: string }) => f.name)).toEqual([
      'apple.txt',
      'banana.txt',
      'cherry.txt',
    ]);
    expect(descending.data.map((f: { name: string }) => f.name)).toEqual([
      'cherry.txt',
      'banana.txt',
      'apple.txt',
    ]);
  });

  it('sorts by size', async () => {
    const { data: folder } = await (await makeFolder(owner.cookies, 'Sizes')).json();
    await upload(owner.cookies, 'small.txt', Buffer.alloc(10, 'a'), folder.id);
    await upload(owner.cookies, 'large.txt', Buffer.alloc(400, 'a'), folder.id);
    await upload(owner.cookies, 'medium.txt', Buffer.alloc(120, 'a'), folder.id);

    const page = await browse(owner.cookies, `folder=${folder.id}&sort=size&order=desc`);

    expect(page.data.map((f: { name: string }) => f.name)).toEqual([
      'large.txt',
      'medium.txt',
      'small.txt',
    ]);
  });
});
