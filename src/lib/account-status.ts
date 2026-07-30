/**
 * A 'Nonaktif' account keeps its Clerk session — Clerk knows nothing about the
 * app-level status — so the block has to happen on our side, on every request.
 *
 * Pure (no server-only imports) so the tRPC middleware and the client shell can
 * share one message: the client recognises a deactivation by comparing against
 * this exact string, and shows the dedicated screen instead of a generic error.
 */
export const ACCOUNT_DEACTIVATED_MESSAGE =
  'Akun Anda dinonaktifkan. Hubungi administrator untuk mengaktifkannya kembali.';
