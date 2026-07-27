import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/components/AuthShell';
import { clerkAppearance } from '@/components/clerk-appearance';

export const metadata: Metadata = { title: 'Daftar' };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Mulai kelola pertanahan desa."
      subtitle="Buat akun untuk mengajukan berkas SPPTG. Admin desa dapat menaikkan peran akun Anda setelah terdaftar."
      points={[
        'Ajukan berkas lengkap dengan dokumen pendukung',
        'Gambar batas lahan di peta atau impor berkas KML/KMZ',
        'Terima notifikasi setiap perubahan status pengajuan',
      ]}
    >
      <SignUp appearance={clerkAppearance} signInUrl="/sign-in" forceRedirectUrl="/app" />
    </AuthShell>
  );
}
