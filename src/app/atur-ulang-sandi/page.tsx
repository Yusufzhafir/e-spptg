import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';

export const metadata: Metadata = { title: 'Atur Ulang Kata Sandi' };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Buat kata sandi baru."
      subtitle="Pilih kata sandi yang kuat dan tidak Anda pakai di layanan lain."
      points={[
        'Minimal 8 karakter dengan huruf besar, kecil, dan angka',
        'Tautan ini hanya berlaku sekali pakai',
        'Perangkat lain akan otomatis keluar demi keamanan',
      ]}
    >
      {/* The token arrives as `?token=`, read with useSearchParams. */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
