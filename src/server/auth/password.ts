import 'server-only';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

// `promisify` resolves to the 3-argument overload, which drops the options bag
// we need for N/r/p and maxmem. Re-declare the signature we actually call.
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

/**
 * scrypt parameters. N=16384/r=8/p=1 is the classic "interactive login" preset:
 * ~16 MB of memory and roughly 50–100 ms per hash on the app server, which is
 * slow enough to make offline cracking expensive without making a login request
 * feel sluggish.
 *
 * They are encoded into every digest, so raising them later only affects new
 * passwords — existing ones keep verifying with the values they were made with.
 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

// 128 * N * r is scrypt's working set; Node's default maxmem (32 MB) is only
// just above it, so state it explicitly rather than sitting on the edge.
const MAX_MEM = 256 * SCRYPT_N * SCRYPT_R;

/** `scrypt$N$r$p$salt$hash`, both parts base64 — mirrors the PHC-style layout. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM,
  });

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Constant-time check of `password` against a stored digest. Returns false —
 * never throws — for malformed or unknown-algorithm digests, so a corrupted row
 * reads as "wrong password" instead of crashing the login route.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltRaw, 'base64');
    expected = Buffer.from(hashRaw, 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: 256 * N * r,
    });
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Burn roughly one hash worth of CPU when the email does not exist or the
 * account has no password yet. Without it, "unknown email" answers noticeably
 * faster than "wrong password" and the login form becomes an account
 * enumeration oracle.
 */
export async function fakeVerifyPassword(password: string): Promise<void> {
  await scrypt(password.normalize('NFKC'), randomBytes(SALT_LENGTH), KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM,
  });
}
