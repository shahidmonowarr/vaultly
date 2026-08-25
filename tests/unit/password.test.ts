import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/server/lib/password';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const digest = await hashPassword('correct horse battery');
    await expect(verifyPassword(digest, 'correct horse battery')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const digest = await hashPassword('correct horse battery');
    await expect(verifyPassword(digest, 'correct horse batteri')).resolves.toBe(false);
  });

  it('produces a different digest for the same password', async () => {
    const [first, second] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(first).not.toEqual(second);
  });

  it('does not throw on a malformed digest', async () => {
    await expect(verifyPassword('not-a-digest', 'anything')).resolves.toBe(false);
  });
});
