/**
 * Why an SSO sign-in ended on the login page instead of the dashboard.
 *
 * The handshake redirects carry a **code**, never a message. A message in the
 * query string would let anyone craft a link that makes our own login page
 * display text they wrote — on a `go.id` domain, that is a phishing kit rather
 * than an error report. Codes are a closed set, and unknown ones fall back to
 * the generic failure.
 */
export const SSO_ERROR_MESSAGES = {
  gagal: 'Masuk lewat SSO gagal. Silakan coba lagi atau gunakan email dan kata sandi.',
  kadaluarsa:
    'Sesi masuk SSO sudah kedaluwarsa atau tidak cocok. Silakan ulangi dari halaman ini.',
  'belum-disetujui':
    'Akun SSO Anda belum disetujui oleh admin SSO Kutai Timur, jadi belum bisa dipakai masuk.',
  domain:
    'Masuk lewat SSO hanya untuk akun email instansi yang terdaftar di SSO Kutai Timur. Untuk akun lain, gunakan email dan kata sandi.',
  nonaktif: 'Akun Anda di SIAPTAH dinonaktifkan. Hubungi administrator sistem.',
  dibatalkan: 'Penghubungan akun dibatalkan. Anda belum masuk.',
} as const;

export type SsoErrorCode = keyof typeof SSO_ERROR_MESSAGES;

export function ssoErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return SSO_ERROR_MESSAGES[code as SsoErrorCode] ?? SSO_ERROR_MESSAGES.gagal;
}
