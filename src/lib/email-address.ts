/**
 * One email rule for the whole app — the applicant's contact on Step 1 and the
 * account email in Pengaturan → Pengguna. Deliberately conservative: it accepts
 * ordinary addresses and rejects the shapes people actually mistype (missing @,
 * missing domain, trailing dot, spaces), rather than chasing RFC 5322 corners
 * no citizen will ever enter.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/** True when the value is a well-formed email address. */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('..')) return false;
  return EMAIL.test(trimmed);
}

/** Lowercased and trimmed — emails are case-insensitive in practice. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Single message so every form and schema words it the same way. */
export const EMAIL_ERROR = 'Format email tidak valid, contoh nama@email.com';
