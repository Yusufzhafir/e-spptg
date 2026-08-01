import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { SignInForm } from '@/components/auth/SignInForm';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';

// A login form is a thin page with nothing to rank for, and indexing it splits
// signal away from the landing page. Same reasoning on every auth route.
export const metadata: Metadata = { title: 'Masuk', robots: { index: false, follow: false } };

export default function SignInPage() {
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
      {/* The form reads `?next=` via useSearchParams, which needs a Suspense
          boundary for the page to keep prerendering. */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
