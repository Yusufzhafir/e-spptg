import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { SignInForm } from '@/components/auth/SignInForm';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
import { SsoSignInButton } from '@/components/auth/SsoSignInButton';
import { AuthFormError } from '@/components/auth/AuthFormError';
import { isSsoEnabled } from '@/lib/sso-config';
import { ssoErrorMessage } from '@/lib/sso-messages';
import { safeNextPath } from '@/lib/safe-next';

// A login form is a thin page with nothing to rank for, and indexing it splits
// signal away from the landing page. Same reasoning on every auth route.
export const metadata: Metadata = { title: 'Masuk', robots: { index: false, follow: false } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParam = typeof params.next === 'string' ? params.next : null;
  const ssoCode = typeof params.sso === 'string' ? params.sso : null;

  // Read on the server on purpose. A `NEXT_PUBLIC_` flag would be inlined at
  // build time, so turning SSO on or off would need a rebuild of the image
  // rather than an env change and a restart.
  const ssoEnabled = isSsoEnabled();

  return (
    <AuthShell
      title="Selamat datang kembali."
      subtitle="Masuk untuk melanjutkan pendataan, verifikasi, dan penerbitan SPPTG di wilayah Anda."
      points={[
        'Lanjutkan pengajuan yang tersimpan tanpa kehilangan progres',
        'Pantau status setiap berkas beserta jejak auditnya',
        'Akses peta sebaran lahan dan pengecekan tumpang tindih',
      ]}
    >
      <div className="space-y-5">
        {/* Why the SSO handshake sent them back, if it did. */}
        <AuthFormError message={ssoErrorMessage(ssoCode)} />

        {ssoEnabled && <SsoSignInButton next={safeNextPath(nextParam)} />}

        {/* The form reads `?next=` via useSearchParams, which needs a Suspense
            boundary for the page to keep prerendering. */}
        <Suspense fallback={<AuthFormSkeleton />}>
          <SignInForm />
        </Suspense>
      </div>
    </AuthShell>
  );
}
