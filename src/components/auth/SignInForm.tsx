'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/FieldError';
import { PasswordInput } from './PasswordInput';
import { AuthFormError } from './AuthFormError';
import { isValidEmail } from '@/lib/email-address';
import { EMAIL_NOT_VERIFIED_MESSAGE } from '@/lib/account-status';
import { safeNextPath } from '@/lib/safe-next';

/**
 * Sign-in in two steps: email first, then a password — but only once the server
 * has confirmed there is a password to type. An account an admin created as an
 * invite has none, and is sent to the reset flow instead of being asked for
 * something that does not exist.
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  /**
   * Stays true from a successful submit until this form is unmounted by the
   * navigation it started. Without it the button re-enables for a frame: the
   * mutation's `isPending` flips back to false the moment the request resolves,
   * while `router.replace` still has a round trip to go, so "Masuk" flashes
   * clickable right after a successful login. Only ever set on success — a
   * failed attempt must leave the form usable.
   */
  const [isRedirecting, setIsRedirecting] = useState(false);
  /** Confirmation shown after "kirim ulang email verifikasi". */
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const next = safeNextPath(searchParams.get('next'));

  const checkEmail = trpc.auth.checkEmail.useMutation({
    onSuccess: (result) => {
      if (result.next === 'sso') {
        // This address signs in through SSO Kutai Timur and has no password to
        // ask for. Point at the button rather than sending them round the reset
        // flow for a password they will never use.
        setFormError(
          'Akun ini masuk lewat SSO Kutai Timur. Gunakan tombol "Masuk dengan SSO Kutai Timur" di atas.'
        );
        return;
      }
      if (result.next === 'reset') {
        // The account exists but has never had a password set. Hand off to the
        // reset flow with the address prefilled and the reason spelled out, so
        // the page can explain why they are there instead of looking like a
        // dead end.
        setIsRedirecting(true);
        router.push(
          `/lupa-sandi?email=${encodeURIComponent(email.trim())}&alasan=belum-ada-sandi`
        );
        return;
      }
      setStep('password');
      // Focus lands on the field that just appeared; without this the user has
      // to click into it after the step change.
      requestAnimationFrame(() => passwordRef.current?.focus());
    },
    onError: (error) => setFormError(error.message),
  });

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setIsRedirecting(true);
      // The session cookie changed, so every cached query belongs to the old
      // (anonymous) session. Clear before navigating, or the dashboard renders
      // from an empty/401 cache for a beat.
      queryClient.clear();
      router.replace(next);
      router.refresh();
    },
    onError: (error) => setFormError(error.message),
  });

  const resendVerification = trpc.auth.resendVerificationEmail.useMutation({
    onSuccess: (result) => {
      setFormError(null);
      setResendNotice(result.message);
    },
    onError: (error) => setFormError(error.message),
  });

  const isPending = checkEmail.isPending || login.isPending || isRedirecting;

  /**
   * Matching on the exact server message rather than the error code: FORBIDDEN
   * also covers a deactivated account, and only one of the two is something the
   * person can fix themselves.
   */
  const needsVerification = formError === EMAIL_NOT_VERIFIED_MESSAGE;

  const backToEmail = () => {
    setStep('email');
    setPassword('');
    setFormError(null);
    setErrors({});
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const value = email.trim();

    if (step === 'email') {
      if (!value) {
        setErrors({ email: 'Email wajib diisi' });
        return;
      }
      if (!isValidEmail(value)) {
        setErrors({ email: 'Format email tidak valid' });
        return;
      }
      setErrors({});
      checkEmail.mutate({ email: value });
      return;
    }

    if (!password) {
      setErrors({ password: 'Kata sandi wajib diisi' });
      return;
    }
    setErrors({});
    login.mutate({ email: value, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Masuk</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          {step === 'email'
            ? 'Masukkan email akun SIAPTAH Anda untuk melanjutkan.'
            : 'Masukkan kata sandi Anda.'}
        </p>
      </div>

      <AuthFormError message={formError} />

      {needsVerification && !resendNotice && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          Belum menerima emailnya?{' '}
          <button
            type="button"
            disabled={resendVerification.isPending}
            onClick={() => resendVerification.mutate({ email: email.trim() })}
            className="font-semibold underline underline-offset-2 hover:text-amber-900 disabled:opacity-60"
          >
            {resendVerification.isPending
              ? 'Mengirim…'
              : 'Kirim ulang email verifikasi'}
          </button>
        </div>
      )}

      {resendNotice && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-800">
          {resendNotice}
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        {/* The field stays mounted across both steps rather than being swapped
            out: password managers need a visible username input next to the
            password one to offer and save a credential. On step 2 it goes
            read-only instead of disappearing. */}
        <div className="relative">
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="username"
            autoFocus={step === 'email'}
            readOnly={step === 'password'}
            placeholder="nama@gmail.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            className={[
              errors.email ? 'border-red-500' : '',
              step === 'password' ? 'bg-gray-50 pr-20 text-gray-600' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          {step === 'password' && (
            <button
              type="button"
              onClick={backToEmail}
              className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              <Pencil className="h-3 w-3" />
              Ganti
            </button>
          )}
        </div>
        <FieldError message={errors.email} />
      </div>

      {step === 'password' && (
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Kata Sandi</Label>
            <Link
              href={`/lupa-sandi?email=${encodeURIComponent(email.trim())}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Lupa kata sandi?
            </Link>
          </div>
          <PasswordInput
            id="password"
            ref={passwordRef}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            className={errors.password ? 'border-red-500' : undefined}
          />
          <FieldError message={errors.password} />
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isPending ? 'Memproses…' : 'Masuk'}
      </Button>

      {step === 'email' && (
        <p className="text-center text-sm text-gray-500">
          Belum punya akun?{' '}
          <Link
            href="/sign-up"
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Daftar sekarang
          </Link>
        </p>
      )}
    </form>
  );
}
