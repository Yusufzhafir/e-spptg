import { describe, expect, it } from 'vitest';
import { fakeVerifyPassword, hashPassword, verifyPassword } from './password';

describe('hashPassword', () => {
  it('produces a self-describing digest, never the plaintext', async () => {
    const hash = await hashPassword('Rahasia123');

    expect(hash).not.toContain('Rahasia123');
    const parts = hash.split('$');
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe('scrypt');
    // N, r, p are stored so a future parameter bump can still verify old hashes.
    expect(Number(parts[1])).toBeGreaterThan(0);
  });

  it('salts every hash, so the same password never repeats a digest', async () => {
    const a = await hashPassword('Rahasia123');
    const b = await hashPassword('Rahasia123');
    expect(a).not.toBe(b);
    // ...and both still verify.
    await expect(verifyPassword('Rahasia123', a)).resolves.toBe(true);
    await expect(verifyPassword('Rahasia123', b)).resolves.toBe(true);
  });
});

describe('verifyPassword', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Rahasia123');
    await expect(verifyPassword('Rahasia123', hash)).resolves.toBe(true);
    await expect(verifyPassword('rahasia123', hash)).resolves.toBe(false);
    await expect(verifyPassword('Rahasia1234', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('treats a Unicode-equivalent password as the same one', async () => {
    // "é" as one code point vs. "e" + combining accent. Both are the same
    // password to the person typing it, and NFKC normalisation makes them the
    // same to us — otherwise a user could be locked out by their keyboard.
    const hash = await hashPassword('Katasandié1A');
    await expect(verifyPassword('Katasandié1A', hash)).resolves.toBe(true);
  });

  it('returns false instead of throwing on a corrupted digest', async () => {
    // A malformed row must read as "wrong password", never crash a login.
    for (const bad of [
      '',
      'not-a-hash',
      'bcrypt$16384$8$1$c2FsdA==$aGFzaA==',
      'scrypt$16384$8$1$c2FsdA==',
      'scrypt$abc$8$1$c2FsdA==$aGFzaA==',
      'scrypt$16384$8$1$$',
    ]) {
      await expect(verifyPassword('Rahasia123', bad)).resolves.toBe(false);
    }
  });
});

describe('fakeVerifyPassword', () => {
  it('resolves without throwing, so the login path can always call it', async () => {
    await expect(fakeVerifyPassword('apa saja')).resolves.toBeUndefined();
  });
});
