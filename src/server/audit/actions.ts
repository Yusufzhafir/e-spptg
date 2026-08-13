/**
 * Human-readable labels for audit actions, and the entity each belongs to.
 *
 * Actions are tRPC procedure paths (`users.update`), so a new mutation is
 * recorded automatically by the middleware even if nobody adds it here — it
 * just shows its raw path until a label is written for it. That is the right
 * default: an unlabelled entry in the trail beats a missing one.
 *
 * Pure module: the Superadmin UI imports these labels too.
 */

export type AuditEntity =
  | 'pengguna'
  | 'pengajuan'
  | 'draf'
  | 'desa'
  | 'kawasan'
  | 'dokumen'
  | 'komentar'
  | 'notifikasi'
  | 'autentikasi'
  | 'audit';

export const ENTITY_LABEL: Record<AuditEntity, string> = {
  pengguna: 'Pengguna',
  pengajuan: 'Pengajuan',
  draf: 'Draf',
  desa: 'Desa',
  kawasan: 'Kawasan Non-SPPTG',
  dokumen: 'Dokumen',
  komentar: 'Komentar',
  notifikasi: 'Notifikasi',
  autentikasi: 'Autentikasi',
  audit: 'Audit Log',
};

/**
 * Router name -> entity. **Every router in `_app.ts` is mapped here**, so there
 * is no catch-all bucket: an entry always says what kind of data it touched.
 *
 * A router added later without a line here falls back to its own name rather
 * than to a meaningless "Lainnya" — the entry is still precise, it just shows
 * the raw router name until a label is added. Keep this in step with
 * `src/trpc/routers/_app.ts`.
 */
const ROUTER_ENTITY: Record<string, AuditEntity> = {
  users: 'pengguna',
  submissions: 'pengajuan',
  drafts: 'draf',
  villages: 'desa',
  prohibitedAreas: 'kawasan',
  documents: 'dokumen',
  comments: 'komentar',
  notifications: 'notifikasi',
  auth: 'autentikasi',
  audit: 'audit',
};

export function entityForAction(aksi: string): string {
  const routerName = aksi.split('.')[0];
  return ROUTER_ENTITY[routerName] ?? routerName;
}

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Masuk',
  'auth.logout': 'Keluar',
  'auth.register': 'Daftar akun',
  'auth.changePassword': 'Ganti kata sandi',
  'auth.resetPassword': 'Atur ulang kata sandi',
  'auth.requestPasswordReset': 'Minta tautan atur ulang sandi',
  'auth.verifyEmail': 'Verifikasi email',
  'auth.resendVerificationEmail': 'Kirim ulang email verifikasi',
  'auth.revokeAllSessions': 'Keluarkan semua perangkat',

  'users.create': 'Tambah pengguna',
  'users.update': 'Ubah pengguna',
  'users.toggleStatus': 'Aktif/nonaktifkan pengguna',
  'users.sendPasswordResetLink': 'Kirim tautan atur ulang sandi',

  'submissions.submitDraft': 'Kirim pengajuan',
  'submissions.updateStatus': 'Ubah status pengajuan',
  'submissions.updateValidity': 'Ubah validitas pengajuan',
  'submissions.checkOverlapsFromCoordinates': 'Cek tumpang tindih',

  'drafts.create': 'Buat draf',
  'drafts.createFromSubmission': 'Buat draf dari pengajuan',
  'drafts.saveStep': 'Simpan langkah draf',
  'drafts.delete': 'Hapus draf',

  'villages.create': 'Tambah desa',
  'villages.update': 'Ubah desa',
  'villages.delete': 'Hapus desa',

  'prohibitedAreas.create': 'Tambah kawasan Non-SPPTG',
  'prohibitedAreas.createBulk': 'Impor kawasan Non-SPPTG',
  'prohibitedAreas.update': 'Ubah kawasan Non-SPPTG',
  'prohibitedAreas.delete': 'Hapus kawasan Non-SPPTG',

  'documents.uploadFile': 'Unggah dokumen',
  'documents.delete': 'Hapus dokumen',
  'documents.createUploadUrl': 'Minta URL unggah',

  'comments.create': 'Tambah komentar',
  'comments.delete': 'Hapus komentar',

  'audit.delete': 'Hapus entri audit',
};

export function actionLabel(aksi: string): string {
  return ACTION_LABEL[aksi] ?? aksi;
}

/** Every action that has a label, for the filter dropdown. */
export function knownActions(): { aksi: string; label: string; entitas: string }[] {
  return Object.keys(ACTION_LABEL)
    .map((aksi) => ({ aksi, label: ACTION_LABEL[aksi], entitas: entityForAction(aksi) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'id'));
}
