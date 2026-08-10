/**
 * Only same-origin, absolute-path targets are accepted as a post-login
 * destination. Anything else — a full URL, or a protocol-relative
 * `//evil.example` — would turn a login redirect into an open redirect, which is
 * a ready-made phishing landing page on a government domain.
 *
 * Shared by the sign-in form and the SSO handshake so the two cannot drift.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}
