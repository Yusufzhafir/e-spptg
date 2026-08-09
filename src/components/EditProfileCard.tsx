'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { AvatarCropDialog } from './AvatarCropDialog';
import { UserAvatar } from './UserAvatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { FieldError } from './FieldError';
import { RequiredMark } from './RequiredMark';
import { AuthFormError } from './auth/AuthFormError';
import { createUserSchema } from '@/lib/validation';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
  PHONE_NUMBER_ERROR,
} from '@/lib/phone-number';

type ProfileUser = {
  nama: string;
  email: string;
  peran: string;
  nipNik: string;
  nomorHP: string | null;
  fotoProfilUrl: string | null;
};

/** Refused before upload; the crop step would otherwise decode a huge file. */
const MAX_PICKED_BYTES = 10 * 1024 * 1024;

/**
 * The signed-in user's own profile: read-only by default, with the two contact
 * fields they may correct themselves.
 *
 * Nama, email, peran and desa are shown but never editable here — they decide
 * who the account is and what it may do, so changing them stays with an admin
 * in Pengaturan. `auth.updateProfile` enforces the same split server-side.
 */
export function EditProfileCard({ user }: { user: ProfileUser }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedPhoto, setPickedPhoto] = useState<File | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nipNik, setNipNik] = useState(user.nipNik);
  const [nomorHP, setNomorHP] = useState(user.nomorHP ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      // `auth.me` is what the whole shell reads the user from, and it is cached
      // for five minutes — without this the page would keep showing the old
      // number until that expires.
      await utils.auth.me.invalidate();
      setIsEditing(false);
      setErrors({});
      toast.success('Profil berhasil diperbarui');
    },
    onError: (error) => setFormError(error.message),
  });

  const uploadAvatar = trpc.auth.uploadAvatar.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setIsCropOpen(false);
      setPickedPhoto(null);
      toast.success('Foto profil berhasil diperbarui');
    },
    onError: (error) => toast.error(error.message),
  });

  const removeAvatar = trpc.auth.removeAvatar.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success('Foto profil dihapus');
    },
    onError: (error) => toast.error(error.message),
  });

  const handlePickPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately: picking the same file twice in a row fires no change
    // event otherwise, so a cancelled crop could not be retried.
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Berkas harus berupa gambar.');
      return;
    }
    if (file.size > MAX_PICKED_BYTES) {
      toast.error('Ukuran gambar maksimal 10 MB.');
      return;
    }

    setPickedPhoto(file);
    setIsCropOpen(true);
  };

  const startEditing = () => {
    setNipNik(user.nipNik);
    setNomorHP(user.nomorHP ?? '');
    setErrors({});
    setFormError(null);
    setIsEditing(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};

    // The same schema the mutation uses, so the form cannot accept something
    // the server would then reject.
    const parsedNipNik = createUserSchema.shape.nipNik.safeParse(nipNik);
    if (!parsedNipNik.success) next.nipNik = parsedNipNik.error.issues[0].message;

    const trimmedPhone = nomorHP.trim();
    if (trimmedPhone && !isValidPhoneNumber(trimmedPhone)) {
      next.nomorHP = PHONE_NUMBER_ERROR;
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    updateProfile.mutate({ nipNik, nomorHP: trimmedPhone });
  };

  const errorClass = (field: string) => (errors[field] ? 'border-red-500' : undefined);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <UserCircle className="h-4 w-4 text-blue-600" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900">Profil Saya</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Foto, NIP/NIK dan nomor HP dapat Anda ubah sendiri. Untuk nama,
              email, dan peran, hubungi administrator.
            </p>
          </div>
        </div>

        {!isEditing && (
          <Button type="button" variant="outline" size="sm" onClick={startEditing}>
            Ubah Profil
          </Button>
        )}
      </div>

      {/* Photo: stacked on a phone, side by side from `sm` up. */}
      <div className="mt-5 flex flex-col items-center gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center">
        <UserAvatar
          nama={user.nama}
          email={user.email}
          fotoProfilUrl={user.fotoProfilUrl}
          className="h-24 w-24 sm:h-20 sm:w-20"
          textClassName="text-2xl"
        />

        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatar.isPending || removeAvatar.isPending}
            >
              <Camera className="mr-2 h-4 w-4" />
              {user.fotoProfilUrl ? 'Ganti Foto' : 'Unggah Foto'}
            </Button>

            {user.fotoProfilUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => removeAvatar.mutate()}
                disabled={uploadAvatar.isPending || removeAvatar.isPending}
              >
                {removeAvatar.isPending ? 'Menghapus...' : 'Hapus Foto'}
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-gray-500 sm:text-left">
            JPG, PNG atau WebP. Posisi foto dapat diatur setelah dipilih.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickPhoto}
        />
      </div>

      <AvatarCropDialog
        file={pickedPhoto}
        open={isCropOpen}
        onOpenChange={(next) => {
          setIsCropOpen(next);
          if (!next) setPickedPhoto(null);
        }}
        onCropped={(result) => uploadAvatar.mutate(result)}
        isSaving={uploadAvatar.isPending}
      />

      {isEditing ? (
        <form onSubmit={handleSubmit} className="mt-5 max-w-md space-y-4" noValidate>
          <AuthFormError message={formError} />

          <div>
            <Label htmlFor="profil-nipNik">
              NIP/NIK
              <RequiredMark />
            </Label>
            <Input
              id="profil-nipNik"
              inputMode="numeric"
              maxLength={20}
              placeholder="Masukkan NIP atau NIK (minimal 16 angka)"
              value={nipNik}
              // Digits only, max 20 — enforced while typing so the field can
              // never hold a value the schema would reject.
              onChange={(event) => {
                setNipNik(event.target.value.replace(/\D/g, '').slice(0, 20));
                setErrors((prev) => ({ ...prev, nipNik: '' }));
              }}
              className={errorClass('nipNik')}
            />
            <FieldError message={errors.nipNik} />
          </div>

          <div>
            <Label htmlFor="profil-nomorHP">Nomor HP</Label>
            <Input
              id="profil-nomorHP"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08xxxxxxxxxx atau 0549xxxxxx"
              value={nomorHP}
              onChange={(event) => {
                setNomorHP(event.target.value);
                setErrors((prev) => ({ ...prev, nomorHP: '' }));
              }}
              // Tidy "+62 812…" into 08xxxxxxxxxx once the field loses focus,
              // rather than fighting the keystrokes as they are typed.
              onBlur={(event) => setNomorHP(normalizePhoneNumber(event.target.value))}
              className={errorClass('nomorHP')}
            />
            <FieldError message={errors.nomorHP} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {updateProfile.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={updateProfile.isPending}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Nama Lengkap', value: user.nama },
            { label: 'Email', value: user.email },
            { label: 'NIP/NIK', value: user.nipNik },
            { label: 'Nomor HP', value: user.nomorHP || '—' },
          ].map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {field.label}
              </dt>
              <dd className="mt-1 break-words text-sm text-gray-900">{field.value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Peran
            </dt>
            <dd className="mt-1">
              <Badge variant="outline" className="border-blue-600 bg-blue-50 text-blue-700">
                {user.peran}
              </Badge>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
