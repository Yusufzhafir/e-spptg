import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Link2, ShieldQuestion } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import {
  SSO_PENDING_LINK_COOKIE_NAME,
  getSsoConfig,
  readPendingLink,
} from '@/server/auth/sso';

export const metadata: Metadata = {
  title: 'Hubungkan Akun SSO',
  robots: { index: false, follow: false },
};

// Reads a cookie, so it can never be prerendered.
export const dynamic = 'force-dynamic';

/**
 * "Akun Ditemukan" — shown when SSO vouches for an email that already has a
 * SIAPTAH account which has never been linked to an SSO identity.
 *
 * A deliberate stop, per section 4 of the Diskominfo manual. Linking silently
 * would mean anyone able to authenticate as this address at the IdP inherits
 * whatever the local account can do, without its owner ever being asked.
 *
 * Plain form posts, no client JavaScript: the pending link lives in a signed
 * `SameSite=Lax` cookie, which a browser refuses to send on a cross-site POST —
 * so the CSRF protection is the cookie policy itself, not a token we manage.
 */
export default async function HubungkanSsoPage() {
  const config = getSsoConfig();
  if (!config) redirect('/sign-in');

  const cookieStore = await cookies();
  const pending = readPendingLink(
    cookieStore.get(SSO_PENDING_LINK_COOKIE_NAME)?.value,
    config
  );

  // No pending link means the cookie expired, was never set, or failed its
  // signature check. Nothing to confirm — start over.
  if (!pending) redirect('/sign-in?sso=kadaluarsa');

  return (
    <AuthShell
      title="Akun Anda sudah terdaftar."
      subtitle="Hubungkan akun SIAPTAH Anda dengan SSO Kutai Timur agar berikutnya cukup satu kali klik."
      points={[
        'Satu identitas untuk seluruh layanan Pemkab Kutai Timur',
        'Kata sandi SIAPTAH Anda tetap bisa dipakai seperti biasa',
        'Peran dan seluruh riwayat pengajuan Anda tidak berubah',
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <ShieldQuestion className="h-5 w-5 text-blue-600" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Akun Ditemukan</h1>
            <p className="mt-1 text-sm text-gray-600">
              Email <span className="font-medium text-gray-900">{pending.email}</span> sudah
              terdaftar di SIAPTAH. Hubungkan akun tersebut dengan SSO Kutai Timur?
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Setelah dihubungkan, Anda bisa masuk lewat tombol SSO tanpa konfirmasi lagi. Akun
          SIAPTAH Anda tidak diganti — hanya ditandai bahwa identitas SSO ini miliknya.
        </div>

        <form action="/api/auth/sso/link" method="post" className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" name="aksi" value="hubungkan" className="sm:flex-1">
            <Link2 className="mr-2 h-4 w-4" />
            Ya, Hubungkan
          </Button>
          <Button
            type="submit"
            name="aksi"
            value="batal"
            variant="outline"
            className="sm:flex-1"
          >
            Batal
          </Button>
        </form>

        <p className="text-xs text-gray-500">
          Bukan Anda? Pilih <span className="font-medium">Batal</span>, lalu masuk memakai email
          dan kata sandi.
        </p>
      </div>
    </AuthShell>
  );
}
