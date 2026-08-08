'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Info, Loader2, MailCheck } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/FieldError';
import { AuthFormError } from './AuthFormError';
import { isValidEmail } from '@/lib/email-address';

/**
 * Step 1 of "lupa sandi". The success screen is shown for any well-formed email,
 * matching the server's deliberately vague answer — anything else would let the
 * form be used to check which staff addresses have accounts.
 */
export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  // Both are set when the sign-in form hands off an account that has no
  // password yet, so the page can prefill the address and say why they are here.
  const isPendingInvite = searchParams.get('alasan') === 'belum-ada-sandi';

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const request = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSentTo(email.trim()),
    onError: (error) => setFormError(error.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const value = email.trim();
    if (!value) {
      setFieldError('Email wajib diisi');
      return;
    }
    if (!isValidEmail(value)) {
      setFieldError('Format email tidak valid');
      return;
    }

    setFieldError(undefined);
    request.mutate({ email: value });
  };

  if (sentTo) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
          <MailCheck className="h-6 w-6 text-green-600" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Periksa Email Anda</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Jika <strong>{sentTo}</strong> terdaftar, kami telah mengirim tautan untuk
            mengatur ulang kata sandi. Tautan berlaku 1 jam dan hanya dapat dipakai sekali.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Tidak menerima email? Periksa folder spam, lalu coba kirim ulang.
          </p>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSentTo(null);
              setFormError(null);
            }}
          >
            Kirim Ulang
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/sign-in">Kembali ke Halaman Masuk</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isPendingInvite ? 'Buat Kata Sandi' : 'Lupa Kata Sandi'}
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.
        </p>
      </div>

      {isPendingInvite && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span>
            Akun Anda belum memiliki kata sandi. Kirim tautan di bawah untuk membuatnya,
            lalu Anda dapat masuk seperti biasa.
          </span>
        </div>
      )}

      <AuthFormError message={formError} />

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="nama@gmail.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldError(undefined);
          }}
          className={fieldError ? 'border-red-500' : undefined}
        />
        <FieldError message={fieldError} />
      </div>

      <Button
        type="submit"
        disabled={request.isPending}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {request.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {request.isPending ? 'Mengirim…' : 'Kirim Tautan'}
      </Button>

      <p className="text-center text-sm text-gray-500">
        Ingat kata sandi Anda?{' '}
        <Link
          href="/sign-in"
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Masuk di sini
        </Link>
      </p>
    </form>
  );
}
