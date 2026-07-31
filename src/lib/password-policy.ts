import { z } from 'zod';

/**
 * One password policy for every entry point — registration, the admin "Tambah
 * Pengguna" dialog, "ubah sandi" and the reset-link form — so a password that
 * the form accepts can never be rejected by the server, and vice versa.
 *
 * Pure (no server imports) precisely so the client can share it.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_RULE_TEXT =
  `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter dan memuat huruf besar, huruf kecil, serta angka.`;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter`)
  .max(PASSWORD_MAX_LENGTH, `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter`)
  .refine((value) => /[a-z]/.test(value), 'Kata sandi harus memuat huruf kecil')
  .refine((value) => /[A-Z]/.test(value), 'Kata sandi harus memuat huruf besar')
  .refine((value) => /[0-9]/.test(value), 'Kata sandi harus memuat angka');

/** Rules as individual checks, for the live checklist under the password field. */
export function passwordChecklist(value: string) {
  return [
    { label: `Minimal ${PASSWORD_MIN_LENGTH} karakter`, ok: value.length >= PASSWORD_MIN_LENGTH },
    { label: 'Ada huruf kecil (a-z)', ok: /[a-z]/.test(value) },
    { label: 'Ada huruf besar (A-Z)', ok: /[A-Z]/.test(value) },
    { label: 'Ada angka (0-9)', ok: /[0-9]/.test(value) },
  ];
}
