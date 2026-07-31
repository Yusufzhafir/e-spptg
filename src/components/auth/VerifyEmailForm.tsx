'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { AuthFormError } from './AuthFormError';

/**
 * Landing page for the verification link mailed at self-registration.
 *
 * The redemption fires automatically on arrival rather than behind a "confirm"
 * button: the person already expressed intent by clicking the link in their
 * inbox, and a second click would only be ceremony. The token is checked first
 * so a spent or expired link says so outright.
 */
export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const token = searchParams.get('token') ?? '';

  const [formError, setFormError] = useState<string | null>(null);
  const [doneUnverifiable, setDoneUnverifiable] = useState(false);
  /** Guards against React 18 double-invoking the effect in development, which
   *  would spend the token on the first call and fail on the second. */
  const redeemStarted = useRef(false);

  const tokenCheck = trpc.auth.verifyEmailToken.useQuery(
    { token },
    { enabled: token.length > 0, retry: false }
  );

  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: (result) => {
      queryClient.clear();
      if (result.signedIn) {
        router.replace('/app');
        router.refresh();
        return;
      }
      // Verified, but an admin deactivated the account in the meantime — there
      // is nothing to sign into, so explain rather than bouncing to a dashboard
      // that would refuse them.
      setDoneUnverifiable(true);
    },
    onError: (error) => setFormError(error.message),
  });

  const isValidToken = tokenCheck.data?.valid === true;

  useEffect(() => {
    if (!isValidToken || redeemStarted.current) return;
    redeemStarted.current = true;
    verify.mutate({ token });
  }, [isValidToken, token, verify]);

  if (!token || (tokenCheck.isFetched && !isValidToken)) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-6 w-6 text-red-600" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tautan Tidak Berlaku</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Tautan verifikasi ini tidak valid, sudah digunakan, atau sudah kedaluwarsa.
            Jika akun Anda belum terverifikasi, minta tautan baru dari halaman masuk.
          </p>
        </div>
        <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
          <Link href="/sign-in">Kembali ke Halaman Masuk</Link>
        </Button>
      </div>
    );
  }

  if (doneUnverifiable) {
    return (
      <div className="space-y-5 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Email Terverifikasi</h1>
        <p className="text-sm leading-relaxed text-gray-600">
          Email Anda berhasil diverifikasi, tetapi akun Anda saat ini dinonaktifkan.
          Hubungi administrator untuk mengaktifkannya.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">Kembali ke Halaman Masuk</Link>
        </Button>
      </div>
    );
  }

  if (formError) {
    return (
      <div className="space-y-5">
        <AuthFormError message={formError} />
        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">Kembali ke Halaman Masuk</Link>
        </Button>
      </div>
    );
  }

  // Checking the link, redeeming it, or waiting on the redirect into the app —
  // all three are "nothing for the user to do", so they share one screen.
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        {verify.isSuccess ? (
          <CheckCircle2 className="h-6 w-6 text-blue-600" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        )}
      </span>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {verify.isSuccess ? 'Email Terverifikasi' : 'Memverifikasi Email…'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {verify.isSuccess
            ? 'Akun Anda sudah aktif. Mengalihkan ke dashboard…'
            : 'Mohon tunggu sebentar, kami sedang memeriksa tautan verifikasi Anda.'}
        </p>
      </div>
    </div>
  );
}
