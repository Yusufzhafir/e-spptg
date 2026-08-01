import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';

// Reached only from a link in an email, and the URL carries a single-use token.
export const metadata: Metadata = {
  title: 'Verifikasi Email',
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Satu langkah lagi."
      subtitle="Kami memastikan alamat email Anda benar sebelum akun dapat digunakan."
      points={[
        'Tautan verifikasi berlaku 24 jam',
        'Hanya dapat dipakai satu kali',
        'Setelah terverifikasi Anda langsung masuk ke dashboard',
      ]}
    >
      {/* The token arrives as `?token=`, read with useSearchParams. */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}
