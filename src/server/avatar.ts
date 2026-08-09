import { randomBytes } from 'crypto';
import { getDownloadUrl } from '@/server/s3/s3';

/**
 * Profile photos live in the same private bucket as the berkas, so what reaches
 * the browser is always a signed link rather than a public URL.
 *
 * The TTL is long because the photo is embedded in the header of every page and
 * in user lists — a short link would expire mid-session and leave broken images
 * behind. It is still signed, so the object cannot be read without one.
 */
const AVATAR_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const AVATAR_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

/** Largest cropped photo accepted, after the client has resized it. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * A fresh key per upload, never a stable `avatars/{id}` path: overwriting one
 * key would leave every cached copy — browser, CDN, and the signed links
 * already handed out — showing the previous photo.
 */
export function buildAvatarKey(userId: number, mimeType: string): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'jpg';
  return `avatars/${userId}-${Date.now()}-${randomBytes(4).toString('hex')}.${extension}`;
}

/**
 * Swap the stored object key for a link the browser can load. Returns null for
 * an account with no photo, and also when signing fails — a photo that has gone
 * missing from storage should fall back to the initials avatar, not break the
 * page that renders it.
 */
export async function signAvatarUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  try {
    return await getDownloadUrl(key, AVATAR_URL_TTL_SECONDS);
  } catch (error) {
    console.error('Gagal menandatangani URL foto profil:', error);
    return null;
  }
}
