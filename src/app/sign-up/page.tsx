import type { Metadata } from 'next';
import { AuthShell } from '@/components/AuthShell';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { SsoSignInButton } from '@/components/auth/SsoSignInButton';
import { isSsoEnabled } from '@/lib/sso-config';

export const metadata: Metadata = { title: 'Daftar', robots: { index: false, follow: false } };

export default function SignUpPage() {
  // Staff on the county domain have no reason to invent a second password: the
  // first SSO sign-in creates their account from the claims. Everyone else —
  // gmail.com included — keeps registering with the form below.
  const ssoEnabled = isSsoEnabled();

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
      <div className="space-y-5">
        {ssoEnabled && (
          <SsoSignInButton label="Daftar / masuk dengan SSO Kutai Timur" next="/app" />
        )}
        <SignUpForm />
      </div>
    </AuthShell>
  );
}
