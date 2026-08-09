import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  geometry,
  pgEnum,
  bigint,
  doublePrecision,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum('user_role', [
  'Superadmin',
  'Admin',
  'Verifikator',
  // Read-only oversight for every desa in one kecamatan.
  'Kecamatan',
  'Viewer',
]);

export const userStatusEnum = pgEnum('user_status', [
  'Aktif',
  'Nonaktif',
]);

export const statusSPPTGEnum = pgEnum('status_spptg', [
  'SPPTG terdata',
  'SPPTG terdaftar',
  'SPPTG ditolak',
  'SPPTG ditinjau ulang',
  'Terbit SPPTG',
]);

export const validationStatusEnum = pgEnum('validation_status', [
  'Lolos',
  'Perlu Perbaikan',
]);

export const prohibitedAreaTypeEnum = pgEnum('prohibited_area_type', [
  'Hutan Lindung',
  'Tanah Pemerintah',
  'Cagar Alam',
  'Kawasan Industri',
  'Fasum/Fasos',
  'Sempadan Sungai',
  'Sempadan Pantai',
  'Kawasan Rawan Bencana',
  'Aset TNI/POLRI',
  'Lainnya',
]);

export const documentCategoryEnum = pgEnum('document_category', [
  'KTP',
  'KK',
  'Kwitansi',
  'Permohonan',
  'SK Kepala Desa',
  'Berita Acara',
  'Pernyataan Jual Beli',
  'Asal Usul',
  'Tidak Sengketa',
  'Foto Lahan',
  'SPPG',
  'Lampiran Feedback',
  'Lainnya',
]);

export const coordinateSystemEnum = pgEnum('coordinate_system', [
  'geografis',
  'utm',
]);

export const boundaryDirectionEnum = pgEnum('boundary_direction', [
  'Utara',
  'Timur',
  'Selatan',
  'Barat',
  'Timur Laut',
  'Tenggara',
  'Barat Daya',
  'Barat Laut'
]);

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "users_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    nama: varchar('nama', { length: 255 }).notNull(),
    // scrypt digest produced by `src/server/auth/password.ts`. Nullable: an admin
    // can pre-register a user without choosing a password for them, in which case
    // the account cannot sign in until the person sets one through the
    // "lupa sandi" email flow.
    passwordHash: varchar('password_hash', { length: 255 }),
    nipNik: varchar('nip_nik', { length: 20 }).notNull(),
    // The login identifier, so it has to be unique — not just validated in the
    // router, which cannot stop two concurrent registrations.
    email: varchar('email', { length: 255 }).notNull().unique(),
    peran: userRoleEnum('peran').notNull(),
    assignedVillageId: bigint('assigned_village_id', { mode: 'number' }),
    // Scope for the 'Kecamatan' role: every submission in this kecamatan.
    assignedKecamatan: varchar('assigned_kecamatan', { length: 255 }),
    status: userStatusEnum('status').notNull().default('Aktif'),
    /**
     * When the person proved they own this address by following the link mailed
     * at self-registration. NULL means "registered but not verified", and login
     * refuses that account.
     *
     * Kept separate from `status` on purpose: `status` is the admin's decision
     * ("this account is switched off"), while this is the account's own
     * onboarding state. Folding them into one column would make an unverified
     * signup indistinguishable from an account an admin deliberately disabled,
     * and the two need different messages and different remedies.
     *
     * Accounts an admin creates are stamped verified immediately — the admin
     * typed the address and is vouching for it — as were all rows that existed
     * before this column was introduced.
     */
    emailVerifiedAt: timestamp('email_verified_at'),
    nomorHP: varchar('nomor_hp', { length: 15 }),
    /**
     * S3 object key of the profile photo, not a URL: the bucket is private, so
     * what the client gets is a short-lived signed link generated on read. NULL
     * means "no photo" and the UI falls back to the initials avatar.
     */
    fotoProfil: varchar('foto_profil', { length: 500 }),
    terakhirMasuk: timestamp('terakhir_masuk'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('users_assigned_village_idx').on(t.assignedVillageId),
  ]
);


// ============================================================================
// SESSIONS TABLE
// ============================================================================

/**
 * Server-side sessions for the app's own authentication. The browser only ever
 * holds the opaque token; `id` is its SHA-256 digest, so a leaked database dump
 * cannot be replayed as a login.
 *
 * Rows are deleted (not just expired) on logout and whenever an account is
 * deactivated or its password changes, which is what makes those actions revoke
 * access immediately instead of at the next expiry.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    // Shown in "perangkat aktif" so a user can recognise a session that is not
    // theirs; never used for authorization.
    userAgent: varchar('user_agent', { length: 512 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId),
    index('sessions_expires_at_idx').on(t.expiresAt),
  ]
);

// ============================================================================
// PASSWORD RESET TOKENS TABLE
// ============================================================================

/**
 * Single-use "lupa sandi" tokens mailed out over Gmail SMTP. As with sessions,
 * only the SHA-256 digest of the token is stored.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    // Set once the token is redeemed. Kept rather than deleted so a replay of
    // the same link can be told apart from a link that never existed.
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('password_reset_tokens_user_idx').on(t.userId),
    index('password_reset_tokens_expires_at_idx').on(t.expiresAt),
  ]
);

// ============================================================================
// EMAIL VERIFICATION TOKENS TABLE
// ============================================================================

/**
 * Single-use links that prove a self-registered address is real. Same shape and
 * same digest-only rule as `password_reset_tokens`; the difference is lifetime
 * (24 hours rather than 1) because this link is less sensitive and people often
 * only read their mail hours later.
 */
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('email_verification_tokens_user_idx').on(t.userId),
    index('email_verification_tokens_expires_at_idx').on(t.expiresAt),
  ]
);


// ============================================================================
// AUDIT LOGS TABLE
// ============================================================================

/**
 * Every mutation any signed-in user performs, with the row's state before and
 * after it. Readable only by Superadmin.
 *
 * The actor is denormalised on purpose: `actor_id` has no foreign key and the
 * name/email/role are snapshotted at the time of the action. An audit trail
 * whose entries vanish or become anonymous when the account is deleted, or that
 * shows someone's *current* role next to an action they took under a previous
 * one, is not an audit trail. `actor_id` is kept only so the list can be
 * filtered by person.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({
      name: 'audit_logs_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    actorId: bigint('actor_id', { mode: 'number' }),
    actorNama: varchar('actor_nama', { length: 255 }).notNull(),
    actorEmail: varchar('actor_email', { length: 255 }).notNull(),
    actorPeran: varchar('actor_peran', { length: 32 }).notNull(),

    /** Dotted action id, e.g. `users.update`. Matches the tRPC procedure path
     *  for mutations, so new procedures are covered without a code change. */
    aksi: varchar('aksi', { length: 128 }).notNull(),
    /** Coarse grouping for the filter dropdown: pengguna, desa, kawasan, … */
    entitas: varchar('entitas', { length: 64 }).notNull(),
    /** Primary key of the affected row, when the action targets exactly one. */
    entitasId: bigint('entitas_id', { mode: 'number' }),
    /** One line of Indonesian describing what happened, for the table. */
    ringkasan: text('ringkasan').notNull(),

    /** Row state before and after. Null when the action creates or deletes,
     *  or when the procedure did not capture a snapshot. Secrets are stripped
     *  by `redact()` before anything is written here. */
    sebelum: jsonb('sebelum'),
    sesudah: jsonb('sesudah'),

    /** 'sukses' or 'gagal' — failed attempts are the interesting ones. */
    hasil: varchar('hasil', { length: 16 }).notNull().default('sukses'),
    /** Error message when `hasil = 'gagal'`. */
    galat: text('galat'),

    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    // The default view is "newest first", and every filter narrows that.
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_actor_idx').on(t.actorId),
    index('audit_logs_aksi_idx').on(t.aksi),
    index('audit_logs_entitas_idx').on(t.entitas, t.entitasId),
  ]
);


// ============================================================================
// VILLAGES TABLE
// ============================================================================

export const villages = pgTable(
  'villages',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "villages_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    kodeDesa: varchar('kode_desa', { length: 20 }).notNull(), // BPS code
    namaDesa: varchar('nama_desa', { length: 255 }).notNull(),
    namaKepalaDesa: varchar('nama_kepala_desa', { length: 255 }),
    juruUkurNama: varchar('juru_ukur_nama', { length: 255 }),
    juruUkurJabatan: varchar('juru_ukur_jabatan', { length: 255 }),
    juruUkurInstansi: varchar('juru_ukur_instansi', { length: 255 }),
    juruUkurNomorHP: varchar('juru_ukur_nomor_hp', { length: 20 }),
    kecamatan: varchar('kecamatan', { length: 255 }).notNull(),
    kabupaten: varchar('kabupaten', { length: 255 }).notNull(),
    provinsi: varchar('provinsi', { length: 255 }).notNull(),
    jumlahPengajuan: integer('jumlah_pengajuan').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
);

// ============================================================================
// PROHIBITED AREAS TABLE (with PostGIS Geometry)
// ============================================================================

export const prohibitedAreas = pgTable(
  'prohibited_areas',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "prohibited_areas_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    namaKawasan: varchar('nama_kawasan', { length: 255 }).notNull(),
    jenisKawasan: prohibitedAreaTypeEnum('jenis_kawasan').notNull(),
    sumberData: varchar('sumber_data', { length: 255 }).notNull(),
    dasarHukum: text('dasar_hukum'),
    tanggalEfektif: timestamp('tanggal_efektif').notNull(),
    tanggalUnggah: timestamp('tanggal_unggah').defaultNow().notNull(),
    diunggahOleh: bigint({mode:"number"}),
    statusValidasi: validationStatusEnum('status_validasi')
      .notNull()
      .default('Lolos'),
    aktifDiValidasi: boolean('aktif_di_validasi').notNull().default(true),
    warna: varchar('warna', { length: 7 }).notNull(), // Hex color
    catatan: text('catatan'),
    
    // PostGIS Geometry
    geom: geometry('geom', { type: 'polygon', srid: 4326 }).notNull(),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('prohibited_areas_geom_idx').using('gist', t.geom),
  ]
);

// ============================================================================
// SUBMISSION DRAFTS TABLE (Multi-step Form Storage)
// ============================================================================

export const submissionDrafts = pgTable(
  'submission_drafts',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "submission_drafts_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    userId: bigint('user_id',{mode:"number"})
      .notNull(),
    villageId: bigint('village_id', { mode: 'number' }),
    // When set, this draft edits an existing submission and re-submitting
    // updates that submission in place instead of creating a new one.
    editingSubmissionId: bigint('editing_submission_id', { mode: 'number' }),
    currentStep: integer('current_step').notNull().default(1),
    
    // Entire SubmissionDraft as JSONB
    // This includes all the form data, uploads, coordinates, etc.
    payload: jsonb('payload').$type<object>().notNull(),
    
    lastSaved: timestamp('last_saved').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('submission_drafts_village_idx').on(t.villageId),
  ]
);

// ============================================================================
// SUBMISSIONS TABLE (Final Submitted Records)
// ============================================================================

export const submissions = pgTable(
  'submissions',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "submissions_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    
    // Data Pemilik (Owner)
    namaPemilik: varchar('nama_pemilik', { length: 255 }).notNull(),
    nik: varchar('nik', { length: 16 }).notNull(),
    alamat: text('alamat').notNull(),
    nomorHP: varchar('nomor_hp', { length: 15 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    
    // Data Lahan (Land)
    villageId: bigint({mode:"number"}).notNull(),
    kecamatan: varchar('kecamatan', { length: 255 }).notNull(),
    kabupaten: varchar('kabupaten', { length: 255 }).notNull(),
    luas: doublePrecision('luas').notNull(), // m²
    luasManual: doublePrecision('luas_manual'), // m² (input manual user)
    penggunaanLahan: varchar('penggunaan_lahan', { length: 255 }).notNull(),
    catatan: text('catatan'),
    
    // Peta & Dokumen
    // PostGIS Geometry (Polygon of the land boundary)
    geom: geometry('geom', { type: 'polygon', srid: 4326 }),
    geoJSON: jsonb('geo_json'), // Fallback/reference
    // Full draft payload snapshot at submit time — lets the submission be
    // re-opened for editing with every field/upload pre-filled.
    payload: jsonb('payload'),
    
    // Status
    status: statusSPPTGEnum('status').notNull(),
    // Validasi visual: true = data & polygon ditampilkan di peta, false = disembunyikan
    isValid: boolean('is_valid').notNull().default(true),
    tanggalPengajuan: timestamp('tanggal_pengajuan').notNull(),
    ownerUserId: bigint('owner_user_id', { mode: 'number' }),
    verifikator: bigint({mode:"number"}).notNull(),
    
    // Riwayat (History - mostly read-only, so JSONB is fine)
    // Array of { tanggal, status, petugas, alasan?, feedback? }
    riwayat: jsonb('riwayat').notNull().default([]),
    
    // Feedback (Optional, JSONB for flexibility)
    feedback: jsonb('feedback'),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('submissions_geom_idx').using('gist', t.geom),
    index('submissions_owner_user_idx').on(t.ownerUserId),
    index('submissions_village_idx').on(t.villageId),
  ]
);

// ============================================================================
// DOCUMENTS TABLE (File Management)
// ============================================================================

export const submissions_documents = pgTable(
  'submissions_documents',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "document_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    
    // File metadata
    filename: varchar('filename', { length: 255 }).notNull(),
    fileType: varchar('file_type', { length: 50 }).notNull(), // MIME type
    size: integer('size').notNull(), // bytes
    url: text('url').notNull(), // S3/R2 URL
    
    // Classification
    category: documentCategoryEnum('category').notNull(),
    
    // Links
    submissionId: bigint({mode:"number"}),
    draftId: bigint({mode:"number"}).notNull(),
    uploadedBy: bigint({mode:"number"}).notNull(),
    
    // Status (Temporary vs Permanent)
    // Useful for cleanup jobs: delete temporary files older than 7 days
    isTemporary: boolean('is_temporary').notNull().default(true),
    
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
);

// ============================================================================
// OVERLAP RESULTS TABLE (Cache layer for performance)
// ============================================================================

export const overlapResults = pgTable(
  'overlap_results',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "agriculture_land_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    submissionId: bigint({mode:"number"}).notNull(),
    prohibitedAreaId: bigint({mode:"number"}).notNull(),
    
    // Overlap details
    luasOverlap: doublePrecision('luas_overlap').notNull(), // m²
    percentageOverlap: doublePrecision('percentage_overlap'), // % of submission area
    
    // For quick reference (denormalized)
    namaKawasan: varchar('nama_kawasan', { length: 255 }).notNull(),
    jenisKawasan: prohibitedAreaTypeEnum('jenis_kawasan').notNull(),
    
    // Geometry of the intersection (for visualization)
    intersectionGeom: geometry('intersection_geom', {
      type: 'polygon',
      srid: 4326,
    }),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// ============================================================================
// STATUS HISTORY TABLE (Optional: For detailed auditing)
// ============================================================================
// This is optional. You can also keep history in the `riwayat` JSONB column.
// Use this if you need to query history frequently (e.g., "Find all status changes
// made by Bambang on 2025-01-15").

export const statusHistory = pgTable(
  'status_history',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "status_history_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    submissionId: bigint({mode:"number"}).notNull(),
    statusBefore: statusSPPTGEnum('status_before').notNull(),
    statusAfter: statusSPPTGEnum('status_after').notNull(),
    petugas: bigint({mode:"number"}).notNull(),
    alasan: text('alasan'),
    feedback: jsonb('feedback'),
    tanggal: timestamp('tanggal').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
);

// ============================================================================
// COMMENTS TABLE (internal discussion per submission)
// ============================================================================

export const comments = pgTable(
  'comments',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "comments_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    submissionId: bigint('submission_id', { mode: 'number' }).notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('comments_submission_idx').on(t.submissionId),
  ]
);

// ============================================================================
// NOTIFICATIONS TABLE (submission created/updated events)
// ============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({
      name: "notifications_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    submissionId: bigint('submission_id', { mode: 'number' }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 'created' | 'updated'
    status: statusSPPTGEnum('status').notNull(),
    // Denormalised for cheap listing without a join
    namaPemilik: varchar('nama_pemilik', { length: 255 }).notNull(),
    villageId: bigint('village_id', { mode: 'number' }).notNull(),
    ownerUserId: bigint('owner_user_id', { mode: 'number' }),
    actorUserId: bigint('actor_user_id', { mode: 'number' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('notifications_created_idx').on(t.createdAt),
    index('notifications_village_idx').on(t.villageId),
  ]
);

// ============================================================================
// PUSH SUBSCRIPTIONS TABLE (Web Push / PWA notifications)
// ============================================================================

/**
 * One row per browser/PWA install that agreed to receive notifications. The
 * endpoint is the push service URL the browser handed us and is globally
 * unique, so re-subscribing the same install updates the row instead of piling
 * duplicates up (and sending the same notification several times).
 *
 * `p256dh` and `auth` are the browser's public encryption material — not
 * secrets of ours, but they are what lets the push payload be encrypted, so
 * they are never returned to any client.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({
      name: 'push_subscriptions_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: (9223372036854775807n) as unknown as number,
      cache: 1,
    }),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: varchar('user_agent', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
  },
  (t) => [
    index('push_subscriptions_user_idx').on(t.userId),
  ]
);
