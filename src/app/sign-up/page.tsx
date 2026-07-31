import type { Metadata } from 'next';
import { AuthShell } from '@/components/AuthShell';
import { SignUpForm } from '@/components/auth/SignUpForm';

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
      <SignUpForm />
    </AuthShell>
  );
}
