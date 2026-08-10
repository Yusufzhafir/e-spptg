import { ShieldCheck } from 'lucide-react';

/**
 * "Masuk dengan SSO Kutai Timur".
 *
 * A plain `<a>`, not a button with an onClick: the whole handshake is server
 * redirects, so this works with JavaScript disabled and needs no client bundle.
 * Rendered only when `SSO_ENABLED` is on — the password form below it stays
 * available to everyone either way, which is the point of the separator.
 */
export function SsoSignInButton({
  next,
  label = 'Masuk dengan SSO Kutai Timur',
}: {
  /** Where to land after a successful sign-in; forwarded through the handshake. */
  next?: string;
  label?: string;
}) {
  const href = next
    ? `/api/auth/sso/start?next=${encodeURIComponent(next)}`
    : '/api/auth/sso/start';

  return (
    <div className="space-y-4">
      <a
        href={href}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <ShieldCheck className="h-4 w-4" />
        {label}
      </a>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">atau gunakan email</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  );
}
