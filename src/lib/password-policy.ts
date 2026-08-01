import { z } from 'zod';

/**
 * One password policy for every entry point — registration, the admin "Tambah
 * Pengguna" dialog, "ubah sandi" and the reset-link form — so a password that
 * the form accepts can never be rejected by the server, and vice versa.
 *
 * Pure (no server imports) precisely so the client can share it.
 *
 * The rules are a minimum length plus at least one digit: no required uppercase
 * or lowercase. That is still far weaker than the 8-characters-with-all-three-
 * classes rule this file once had, and it does make accounts easier to guess.
 * scrypt still makes offline cracking expensive and the login rate limit still
 * caps online guessing, but neither compensates for a five-character password.
 */
export const PASSWORD_MIN_LENGTH = 5;
export const PASSWORD_MAX_LENGTH = 72;

/** Matched against the whole password, so any digit anywhere satisfies it. */
const DIGIT_PATTERN = /\d/;

export const PASSWORD_RULE_TEXT = `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter dan mengandung minimal 1 angka.`;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter`)
  // The upper bound stays: scrypt hashes the whole input, so an unbounded
  // password is an unbounded amount of CPU per login attempt.
  .max(PASSWORD_MAX_LENGTH, `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter`)
  .regex(DIGIT_PATTERN, 'Kata sandi harus mengandung minimal 1 angka');

/** Rules as individual checks, for the live checklist under the password field. */
export function passwordChecklist(value: string) {
  return [
    { label: `Minimal ${PASSWORD_MIN_LENGTH} karakter`, ok: value.length >= PASSWORD_MIN_LENGTH },
    { label: 'Mengandung minimal 1 angka', ok: DIGIT_PATTERN.test(value) },
  ];
}
