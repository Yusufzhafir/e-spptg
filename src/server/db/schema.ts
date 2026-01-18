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
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
    nipNik: varchar('nip_nik', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    peran: userRoleEnum('peran').notNull(),
    status: userStatusEnum('status').notNull().default('Aktif'),
    nomorHP: varchar('nomor_hp', { length: 15 }),
    terakhirMasuk: timestamp('terakhir_masuk'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
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
    currentStep: integer('current_step').notNull().default(1),
    
    // Entire SubmissionDraft as JSONB
    // This includes all the form data, uploads, coordinates, etc.
    payload: jsonb('payload').$type<object>().notNull(),
    
    lastSaved: timestamp('last_saved').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
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
    
    // Status
    status: statusSPPTGEnum('status').notNull(),
    tanggalPengajuan: timestamp('tanggal_pengajuan').notNull(),
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
