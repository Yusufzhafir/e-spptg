'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldAlert } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/FieldError';
import { PasswordInput } from './PasswordInput';
import { PasswordChecklist } from './PasswordChecklist';
import { AuthFormError } from './AuthFormError';
import { passwordSchema } from '@/lib/password-policy';
import { resetLinkScreen } from '@/lib/reset-link-state';

/**
 * Step 2 of "lupa sandi", also the landing page for the invite email an admin
 * sends when creating an account without a password.
 *
 * The token is checked before the form renders so an expired link says so
 * outright instead of letting someone type a new password and only then fail.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);

  const tokenCheck = trpc.auth.verifyPasswordResetToken.useQuery(
    { token },
    // Disabled once the password is saved: the link is spent by then, so asking
    // again would only return "invalid" and contradict what just happened. The
    // `submitted` guard in `resetLinkScreen` is what actually makes this safe —
    // this just avoids a pointless request.
    { enabled: token.length > 0 && !submitted, retry: false },
  );

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: (result) => {
      setSubmitted(true);
      queryClient.clear();
      if (result.signedIn) {
        router.replace('/app');
        router.refresh();
        return;
      }
      // Password set, but the account is deactivated — there is nothing to sign
      // into, so say so instead of bouncing them to a dashboard that refuses them.
      setDone(true);
    },
    onError: (error) => setFormError(error.message),
  });

  const screen = resetLinkScreen({
    hasToken: token.length > 0,
    isFetched: tokenCheck.isFetched,
    isValid: tokenCheck.data?.valid ?? false,
    submitted,
    done,
  });

  if (screen === 'invalid') {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-6 w-6 text-red-600" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tautan Tidak Berlaku</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Tautan atur ulang kata sandi ini tidak valid, sudah digunakan, atau sudah
            kedaluwarsa. Silakan minta tautan baru.
          </p>
        </div>
        <div className="space-y-2">
          <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
            <Link href="/lupa-sandi">Minta Tautan Baru</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/sign-in">Kembali ke Halaman Masuk</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Checking the link, or already signed in and waiting on the redirect. Both
  // are "nothing for the user to do yet", so both get the same spinner instead
  // of briefly re-showing the form they just submitted.
  if (screen === 'checking' || screen === 'redirecting') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (screen === 'done') {
    return (
      <div className="space-y-5 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Kata Sandi Diperbarui</h1>
        <p className="text-sm leading-relaxed text-gray-600">
          Kata sandi Anda berhasil disimpan, tetapi akun Anda saat ini dinonaktifkan.
          Hubungi administrator untuk mengaktifkannya kembali.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">Kembali ke Halaman Masuk</Link>
        </Button>
      </div>
    );
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) next.password = parsed.error.issues[0].message;
    if (confirmPassword !== password) {
      next.confirmPassword = 'Konfirmasi kata sandi tidak cocok';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    reset.mutate({ token, newPassword: password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Buat Kata Sandi Baru</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          {tokenCheck.data?.valid ? (
            <>
              Untuk akun <strong className="text-gray-700">{tokenCheck.data.email}</strong>.
            </>
          ) : (
            'Masukkan kata sandi baru untuk akun Anda.'
          )}
        </p>
      </div>

      <AuthFormError message={formError} />

      <div>
        <Label htmlFor="password">Kata Sandi Baru</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          autoFocus
          placeholder="Buat kata sandi baru"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((prev) => ({ ...prev, password: '' }));
          }}
          className={errors.password ? 'border-red-500' : undefined}
        />
        <FieldError message={errors.password} />
        <PasswordChecklist value={password} />
      </div>

      <div>
        <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Ulangi kata sandi baru"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setErrors((prev) => ({ ...prev, confirmPassword: '' }));
          }}
          className={errors.confirmPassword ? 'border-red-500' : undefined}
        />
        <FieldError message={errors.confirmPassword} />
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        Menyimpan kata sandi baru akan mengeluarkan akun Anda dari semua perangkat lain.
      </p>

      <Button
        type="submit"
        disabled={reset.isPending}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {reset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {reset.isPending ? 'Menyimpan…' : 'Simpan Kata Sandi'}
      </Button>
    </form>
  );
}
