/**
 * Deactivating an account deletes its sessions, but a request already in flight
 * still carries a resolved user, so the block is re-checked on every request.
 *
 * Pure (no server-only imports) so the tRPC middleware and the client shell can
 * share one message: the client recognises a deactivation by comparing against
 * this exact string, and shows the dedicated screen instead of a generic error.
 */
export const ACCOUNT_DEACTIVATED_MESSAGE =
  'Akun Anda dinonaktifkan. Hubungi administrator untuk mengaktifkannya kembali.';

/**
 * Kept distinct from the deactivation message on purpose. The two states have
 * different remedies — an unverified account is fixed by the person themselves
 * from their inbox, a deactivated one only by an administrator — so telling
 * someone the wrong one sends them down a dead end.
 *
 * The sign-in form matches on this exact string to offer "kirim ulang email
 * verifikasi" instead of a plain error.
 */
export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Email Anda belum diverifikasi. Periksa kotak masuk dan folder spam untuk tautan verifikasi.';
