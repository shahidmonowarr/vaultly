import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

export async function hashPassword(plain: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(plain.normalize('NFKC'), salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: 64 * 1024 * 1024,
  });

  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

export async function verifyPassword(digest: string, plain: string) {
  const [scheme, n, r, p, salt, key] = digest.split('$');

  if (scheme !== 'scrypt' || !salt || !key) return false;

  const expected = Buffer.from(key, 'base64');
  const derived = await scryptAsync(plain.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });

  return timingSafeEqual(expected, derived);
}
