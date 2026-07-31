'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/FieldError';
import { RequiredMark } from '@/components/RequiredMark';
import { PasswordInput } from './PasswordInput';
import { PasswordChecklist } from './PasswordChecklist';
import { AuthFormError } from './AuthFormError';
import { createUserSchema } from '@/lib/validation';
import { passwordSchema } from '@/lib/password-policy';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
  PHONE_NUMBER_ERROR,
} from '@/lib/phone-number';

/**
 * Public registration. Deliberately asks for nothing about role or desa: every
 * self-registered account starts as a Viewer and an admin promotes it, which is
 * enforced on the server too.
 */
export function SignUpForm() {
  const [form, setForm] = useState({
    nama: '',
    nipNik: '',
    email: '',
    nomorHP: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  /** The address the verification link was sent to. Non-null means the form is
   *  done and the "check your inbox" screen takes over. */
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const register = trpc.auth.register.useMutation({
    // Registration no longer signs anyone in: the account cannot be used until
    // the mailed link is opened, so there is nowhere to redirect to. Swap the
    // form for instructions instead.
    onSuccess: (result) => setSentTo(result.email),
    onError: (error) => setFormError(error.message),
  });

  const isBusy = register.isPending;

  const validate = () => {
    const next: Record<string, string> = {};

    // Same schema the server uses, so the form cannot accept something the
    // mutation would then reject.
    const parsed = createUserSchema
      .pick({ email: true, nama: true, nipNik: true })
      .safeParse({
        email: form.email.trim(),
        nama: form.nama.trim(),
        nipNik: form.nipNik,
      });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '');
        if (field && !next[field]) next[field] = issue.message;
      }
    }

    const password = passwordSchema.safeParse(form.password);
    if (!password.success) next.password = password.error.issues[0].message;

    if (form.confirmPassword !== form.password) {
      next.confirmPassword = 'Konfirmasi kata sandi tidak cocok';
    }

    const nomorHP = form.nomorHP.trim();
    if (nomorHP && !isValidPhoneNumber(nomorHP)) next.nomorHP = PHONE_NUMBER_ERROR;

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    register.mutate({
      nama: form.nama.trim(),
      nipNik: form.nipNik,
      email: form.email.trim(),
      nomorHP: form.nomorHP.trim() || undefined,
      password: form.password,
    });
  };

  const errorClass = (field: string) => (errors[field] ? 'border-red-500' : undefined);

  if (sentTo) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
          <MailCheck className="h-6 w-6 text-blue-600" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Periksa Email Anda</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Kami mengirim tautan verifikasi ke <strong>{sentTo}</strong>. Buka tautan
            tersebut untuk mengaktifkan akun Anda.
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-left text-sm leading-relaxed text-amber-800">
          Akun Anda <strong>belum dapat digunakan untuk masuk</strong> sampai email
          diverifikasi. Tautan berlaku 24 jam. Jika email tidak muncul, periksa folder
          spam.
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">Ke Halaman Masuk</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Daftar Akun</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Buat akun untuk mulai mengajukan berkas SPPTG.
        </p>
      </div>

      <AuthFormError message={formError} />

      <div>
        <Label htmlFor="nama">
          Nama Lengkap
          <RequiredMark />
        </Label>
        <Input
          id="nama"
          autoComplete="name"
          placeholder="Masukkan nama lengkap"
          value={form.nama}
          onChange={(event) => set('nama', event.target.value)}
          className={errorClass('nama')}
        />
        <FieldError message={errors.nama} />
      </div>

      <div>
        <Label htmlFor="nipNik">
          NIP/NIK
          <RequiredMark />
        </Label>
        <Input
          id="nipNik"
          inputMode="numeric"
          maxLength={20}
          placeholder="Masukkan NIP atau NIK"
          value={form.nipNik}
          // Digits only, max 20 — enforced while typing so the field can never
          // hold a value the schema would reject.
          onChange={(event) => set('nipNik', event.target.value.replace(/\D/g, '').slice(0, 20))}
          className={errorClass('nipNik')}
        />
        <FieldError message={errors.nipNik} />
      </div>

      <div>
        <Label htmlFor="email">
          Email
          <RequiredMark />
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="nama@pemda.go.id"
          value={form.email}
          onChange={(event) => set('email', event.target.value)}
          className={errorClass('email')}
        />
        <FieldError message={errors.email} />
        <p className="mt-1 text-xs text-gray-500">
          Dipakai untuk masuk dan menerima tautan atur ulang kata sandi.
        </p>
      </div>

      <div>
        <Label htmlFor="nomorHP">Nomor HP</Label>
        <Input
          id="nomorHP"
          autoComplete="tel"
          placeholder="08xxxxxxxxxx"
          value={form.nomorHP}
          onChange={(event) => set('nomorHP', event.target.value)}
          onBlur={(event) => set('nomorHP', normalizePhoneNumber(event.target.value))}
          className={errorClass('nomorHP')}
        />
        <FieldError message={errors.nomorHP} />
      </div>

      <div>
        <Label htmlFor="password">
          Kata Sandi
          <RequiredMark />
        </Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Buat kata sandi"
          value={form.password}
          onChange={(event) => set('password', event.target.value)}
          className={errorClass('password')}
        />
        <FieldError message={errors.password} />
        <PasswordChecklist value={form.password} />
      </div>

      <div>
        <Label htmlFor="confirmPassword">
          Konfirmasi Kata Sandi
          <RequiredMark />
        </Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Ulangi kata sandi"
          value={form.confirmPassword}
          onChange={(event) => set('confirmPassword', event.target.value)}
          className={errorClass('confirmPassword')}
        />
        <FieldError message={errors.confirmPassword} />
      </div>

      <Button
        type="submit"
        disabled={isBusy}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isBusy ? 'Memproses…' : 'Daftar'}
      </Button>

      <p className="text-center text-sm text-gray-500">
        Sudah punya akun?{' '}
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
