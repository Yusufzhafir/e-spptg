import { redirect } from 'next/navigation';

/**
 * Pengaturan is a set of routes now, not a set of tabs, so the section index
 * has nothing of its own to show — it sends you to the first section.
 *
 * Kept so every existing link and bookmark to /app/pengaturan still lands
 * somewhere sensible.
 */
export default function PengaturanIndexPage() {
  redirect('/app/pengaturan/pengguna');
}
