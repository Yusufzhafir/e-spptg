import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';

export const metadata: Metadata = {
  title: 'Lupa Kata Sandi',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Tidak bisa masuk?"
      subtitle="Kami akan mengirim tautan aman ke email Anda untuk membuat kata sandi baru."
      points={[
        'Tautan berlaku 1 jam dan hanya dapat dipakai sekali',
        'Semua sesi lama otomatis keluar setelah kata sandi diganti',
        'Tidak perlu menghubungi admin untuk kata sandi yang terlupa',
      ]}
    >
      {/* The form reads `?email=` / `?alasan=` (set when the sign-in step hands
          off an account with no password), which needs a Suspense boundary for
          the page to keep prerendering. */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
