import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import { AuthShell } from '@/components/AuthShell';
import { clerkAppearance } from '@/components/clerk-appearance';

export const metadata: Metadata = { title: 'Masuk' };

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
      <SignIn appearance={clerkAppearance} signUpUrl="/sign-up" forceRedirectUrl="/app" />
    </AuthShell>
  );
}
