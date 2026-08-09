'use client';

import { cn } from '@/lib/utils';

/** "Budi Santoso" -> "BS"; falls back to the first letter of the email. */
export function initials(nama: string, email: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.slice(0, 1).toUpperCase() || '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The photo when there is one, the initials when there is not.
 *
 * `object-cover` on a square box is what keeps an unexpected aspect ratio from
 * distorting a face — the crop editor already exports 1:1, this is the backstop
 * for rows uploaded any other way.
 */
export function UserAvatar({
  nama,
  email,
  fotoProfilUrl,
  className,
  textClassName,
}: {
  nama: string;
  email: string;
  fotoProfilUrl?: string | null;
  /** Sizing and shape, e.g. "h-9 w-9 rounded-full". */
  className?: string;
  textClassName?: string;
}) {
  const base = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-white',
    className
  );

  if (fotoProfilUrl) {
    return (
      // A signed S3 URL with a rotating key: next/image would need the storage
      // host allow-listed and would cache a link that expires.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoProfilUrl}
        alt={`Foto profil ${nama}`}
        className={cn(base, 'object-cover')}
      />
    );
  }

  return (
    <span className={base} aria-hidden="true">
      <span className={cn('font-semibold', textClassName)}>{initials(nama, email)}</span>
    </span>
  );
}
