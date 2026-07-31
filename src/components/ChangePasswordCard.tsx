'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { FieldError } from './FieldError';
import { PasswordInput } from './auth/PasswordInput';
import { PasswordChecklist } from './auth/PasswordChecklist';
import { AuthFormError } from './auth/AuthFormError';
import { passwordSchema } from '@/lib/password-policy';

/** Self-service password change for the signed-in user. */
export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      toast.success(
        'Kata sandi berhasil diubah. Perangkat lain telah dikeluarkan.'
      );
    },
    onError: (error) => setFormError(error.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};
    if (!currentPassword) next.currentPassword = 'Kata sandi saat ini wajib diisi';

    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) next.newPassword = parsed.error.issues[0].message;
    else if (newPassword === currentPassword) {
      next.newPassword = 'Kata sandi baru harus berbeda dari kata sandi saat ini';
    }

    if (confirmPassword !== newPassword) {
      next.confirmPassword = 'Konfirmasi kata sandi tidak cocok';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    changePassword.mutate({ currentPassword, newPassword });
  };

  const errorClass = (field: string) => (errors[field] ? 'border-red-500' : undefined);

  return (
    <section
      id="kata-sandi"
      className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <KeyRound className="h-4 w-4 text-blue-600" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-900">Ubah Kata Sandi</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Demi keamanan, mengganti kata sandi akan mengeluarkan akun Anda dari
            semua perangkat lain.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 max-w-md space-y-4" noValidate>
        <AuthFormError message={formError} />

        <div>
          <Label htmlFor="currentPassword">Kata Sandi Saat Ini</Label>
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              setErrors((prev) => ({ ...prev, currentPassword: '' }));
            }}
            className={errorClass('currentPassword')}
          />
          <FieldError message={errors.currentPassword} />
        </div>

        <div>
          <Label htmlFor="newPassword">Kata Sandi Baru</Label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setErrors((prev) => ({ ...prev, newPassword: '' }));
            }}
            className={errorClass('newPassword')}
          />
          <FieldError message={errors.newPassword} />
          <PasswordChecklist value={newPassword} />
        </div>

        <div>
          <Label htmlFor="confirmNewPassword">Konfirmasi Kata Sandi Baru</Label>
          <PasswordInput
            id="confirmNewPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setErrors((prev) => ({ ...prev, confirmPassword: '' }));
            }}
            className={errorClass('confirmPassword')}
          />
          <FieldError message={errors.confirmPassword} />
        </div>

        <Button
          type="submit"
          disabled={changePassword.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {changePassword.isPending ? 'Menyimpan…' : 'Simpan Kata Sandi'}
        </Button>
      </form>
    </section>
  );
}
