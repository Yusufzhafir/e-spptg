import { z } from 'zod';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
  PHONE_NUMBER_ERROR,
} from '@/lib/phone-number';
import { EMAIL_ERROR, isValidEmail } from '@/lib/email-address';
import { PROHIBITED_AREA_TYPES } from '@/lib/prohibited-area-types';
export * from './submission-draft';


export const geomGeoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.array(z.number()))),
});

export const geomGeoJSONMultiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(z.array(z.array(z.number())))),
});

/**
 * The geometry a kawasan may carry. A kawasan is often a set of detached blocks
 * under one SK — and the boundary files that define them arrive as multi-polygon
 * KML — so MultiPolygon is accepted alongside the single-polygon form older
 * clients still send.
 */
export const geomGeoJSONAreaSchema = z.union([
  geomGeoJSONPolygonSchema,
  geomGeoJSONMultiPolygonSchema,
]);

export type GeomGeoJSONArea = z.infer<typeof geomGeoJSONAreaSchema>;
// ============================================================================
// User Schemas
// ============================================================================

/**
 * Contact number on a user account: optional, but a value that *is* typed has
 * to be a usable Indonesian number, and it is stored in the canonical shape so
 * the same person is not filed once as "+62 812…" and once as "0812…".
 *
 * Applies on the server, where the client-side checks in the forms cannot be
 * relied on — and it matters beyond the account page, because a Viewer's
 * account number is what prefills Nomor HP on Step 1 of the wizard.
 */
export const optionalNomorHPSchema = z
  .string()
  .trim()
  .transform((value) => (value ? normalizePhoneNumber(value) : ''))
  .refine((value) => value === '' || isValidPhoneNumber(value), PHONE_NUMBER_ERROR)
  .transform((value) => value || undefined)
  .optional();

/**
 * The same rule where the number is mandatory — self-registration, where it is
 * the only way to reach the applicant besides their email.
 */
export const nomorHPSchema = z
  .string()
  .trim()
  .min(1, 'Nomor HP wajib diisi')
  .transform(normalizePhoneNumber)
  .refine(isValidPhoneNumber, PHONE_NUMBER_ERROR);

export const createUserSchema = z.object({
  email: z.string().refine(isValidEmail, EMAIL_ERROR),
  nama: z.string().min(2, 'Nama minimal 2 karakter'),
  // 16 is the NIK length; a NIP is 18. Anything shorter is a typo or a
  // placeholder, and the number identifies the person on official documents.
  nipNik: z
    .string()
    .trim()
    .regex(/^[0-9]+$/, 'NIP/NIK hanya boleh angka')
    .min(16, 'NIP/NIK minimal 16 angka')
    .max(20, 'NIP/NIK maksimal 20 angka'),
  peran: z.enum(['Superadmin', 'Admin', 'Verifikator', 'Kecamatan', 'Viewer']).optional(),
  assignedVillageId: z.number().int().nullable().optional(),
  assignedKecamatan: z.string().nullable().optional(),
});

export const updateUserSchema = createUserSchema.partial();

// ============================================================================
// Village Schemas
// ============================================================================

export const createVillageSchema = z.object({
  kodeDesa: z.string().min(1, 'Kode desa diperlukan'),
  namaDesa: z.string().min(2, 'Nama desa minimal 2 karakter'),
  namaKepalaDesa: z.string().min(2, 'Nama kepala desa minimal 2 karakter'),
  juruUkurNama: z.string().min(2, 'Nama juru ukur minimal 2 karakter'),
  juruUkurJabatan: z.string().min(2, 'Jabatan juru ukur minimal 2 karakter'),
  juruUkurInstansi: z.string().optional(),
  juruUkurNomorHP: z
    .string()
    .refine(isValidPhoneNumber, `Nomor HP juru ukur tidak valid — ${PHONE_NUMBER_ERROR}`),
  kecamatan: z.string().min(2, 'Kecamatan minimal 2 karakter'),
  kabupaten: z.string().min(2, 'Kabupaten minimal 2 karakter'),
  provinsi: z.string().min(2, 'Provinsi minimal 2 karakter'),
});

export const updateVillageSchema = createVillageSchema.partial();

// ============================================================================
// Prohibited Area Schemas
// ============================================================================

export const createProhibitedAreaSchema = z.object({
  namaKawasan: z.string().min(2, 'Nama kawasan minimal 2 karakter'),
  jenisKawasan: z.enum(PROHIBITED_AREA_TYPES),
  sumberData: z.string().min(2, 'Sumber data minimal 2 karakter'),
  dasarHukum: z.string().optional(),
  tanggalEfektif: z.coerce.date(),
  diunggahOleh: z.number().int('User ID harus integer').optional(), // Optional since we use ctx.appUser.id
  statusValidasi: z.enum(['Lolos', 'Perlu Perbaikan']).optional(),
  aktifDiValidasi: z.boolean().optional(),
  warna: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Warna harus format hex (contoh: #FF5733)'),
  catatan: z.string().nullable(),
  geomGeoJSON: geomGeoJSONAreaSchema,
});

export const updateProhibitedAreaSchema = createProhibitedAreaSchema.partial();

/**
 * A saved-but-unfinished Tambah/Edit Kawasan form.
 *
 * Kawasan drafts live in the browser (`src/lib/kawasan-draft-storage.ts`), not
 * the database, so this schema is here for the **shape** — `KawasanDraftPayload`
 * is what the storage layer reads and writes — rather than to guard a
 * procedure. Every field is optional and none of the "wajib diisi" rules apply:
 * the point of a draft is that it is incomplete, and the full
 * `createProhibitedAreaSchema` runs when the kawasan is actually written.
 * `warna` is absent because Kawasan Non-SPPTG are always red and the field is
 * not user-editable.
 *
 * `tanggalEfektif` stays the `yyyy-mm-dd` string the date input holds rather
 * than a coerced Date, so a half-typed date round-trips instead of being
 * rejected or silently turned into something else.
 */
export const kawasanDraftPayloadSchema = z.object({
  namaKawasan: z.string().max(255).optional(),
  jenisKawasan: z.enum(PROHIBITED_AREA_TYPES).optional(),
  sumberData: z.string().max(255).optional(),
  dasarHukum: z.string().max(1000).optional(),
  tanggalEfektif: z.string().max(32).optional(),
  statusValidasi: z.enum(['Lolos', 'Perlu Perbaikan']).optional(),
  aktifDiValidasi: z.boolean().optional(),
  catatan: z.string().max(4000).nullable().optional(),
  geomGeoJSON: geomGeoJSONAreaSchema.nullable().optional(),
});

export type KawasanDraftPayload = z.infer<typeof kawasanDraftPayloadSchema>;

/**
 * A whole boundary file worth of kawasan in one request.
 *
 * The attributes (jenis, sumber, dasar hukum, tanggal efektif) are the batch's
 * **defaults** — a boundary file comes from one SK, so they are right nearly
 * always — while each kawasan keeps its own name and geometry and may override
 * any of them. *Nearly* is why the overrides exist: one release routinely mixes
 * Hutan Lindung with Hutan Produksi, and a batch-only form left an officer
 * either importing twice or recording the wrong jenis on half the rows.
 *
 * That geometry is a **MultiPolygon**, not a single Polygon: grouping a KLHK
 * release by its name column gives one kawasan made of several detached blocks
 * far more often than not (188 named areas across 1 440 rings in the Kaltim SK),
 * and accepting only Polygon would have meant either one row per ring — 1 440
 * kawasan where there are 188 — or quietly keeping the first block of each.
 *
 * Capped per request so a stray file cannot insert thousands of rows in a
 * single transaction; the client batches to stay under it, sized by vertex
 * count rather than row count (see `kawasan-bulk-import.ts`).
 */
export const createProhibitedAreasBulkSchema = createProhibitedAreaSchema
  .omit({ namaKawasan: true, geomGeoJSON: true })
  .extend({
    areas: z
      .array(
        z.object({
          namaKawasan: z.string().min(2, 'Nama kawasan minimal 2 karakter'),
          geomGeoJSON: geomGeoJSONAreaSchema,
          // Per-kawasan overrides. Absent means "use the batch value", which is
          // why every one of them is optional rather than defaulted here — a
          // default would make "not overridden" indistinguishable from
          // "overridden with the same value".
          jenisKawasan: z.enum(PROHIBITED_AREA_TYPES).optional(),
          sumberData: z.string().min(2, 'Sumber data minimal 2 karakter').optional(),
          dasarHukum: z.string().optional(),
          tanggalEfektif: z.coerce.date().optional(),
          statusValidasi: z.enum(['Lolos', 'Perlu Perbaikan']).optional(),
          aktifDiValidasi: z.boolean().optional(),
        })
      )
      .min(1, 'Minimal 1 kawasan diperlukan')
      .max(200, 'Maksimal 200 kawasan per permintaan'),
  });

// ============================================================================
// Submission Schemas
// ============================================================================

export const createSubmissionFromDraftSchema = z.object({
  draftId: z.number().int('Draft ID harus integer'),
});

export const updateSubmissionStatusSchema = z.object({
  submissionId: z.number().int('Submission ID harus integer'),
  newStatus: z.enum([
    'SPPTG terdata',
    'SPPTG terdaftar',
    'SPPTG ditolak',
    'SPPTG ditinjau ulang',
    'Terbit SPPTG',
  ]),
  alasan: z.string().optional(),
  feedback: z.any().optional(),
});

// ============================================================================
// Document Schemas
// ============================================================================

const fileCategoryEnum = z.enum([
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
    'SPPTG Induk',
    'Lampiran Feedback',
    'Lainnya',
  ])

export const createUploadUrlSchema = z.object({
  draftId: z.number().int('Draft ID harus integer'),
  category: fileCategoryEnum,
  filename: z.string().min(1, 'Nama file diperlukan'),
  size: z.number().int().positive('Ukuran file tidak valid'),
  mimeType: z
    .enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    .or(z.string()),
});

export const uploadFileSchema = z.object({
  draftId: z.number().int('Draft ID harus integer'),
  documentId: z.number().int('Document ID harus integer'),
  s3Key: z.string().min(1, 'S3 key diperlukan'),
  fileData: z.string().min(1, 'Data file diperlukan'), // base64 string
  filename: z.string().min(1, 'Nama file diperlukan'),
  mimeType: z
    .enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    .or(z.string()),
  size: z.number().int().positive('Ukuran file tidak valid'),
});

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Dashboard filters shared by the submissions list and the KPI / monthly-trend
 * charts, so all three describe the same data set. Optional: no input = unfiltered.
 */
export const dashboardFilterSchema = z
  .object({
    search: z.string().optional(),
    status: z.string().optional(),
    desaId: z.number().int().positive().optional(),
    kecamatan: z.string().optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional()
  .default({});

/**
 * Ordering is part of the request now that the table is paged in Postgres —
 * sorting one page in the browser would order the wrong ten rows.
 */
export const submissionSortKeySchema = z.enum([
  'id',
  'namaPemilik',
  'kecamatan',
  'luas',
  'tanggalPengajuan',
  'status',
  'isValid',
  'verifikator',
  'updatedAt',
]);

/** Client-safe: the table and the query agree on one list of sort keys. */
export type SubmissionSortKey = z.infer<typeof submissionSortKeySchema>;

export const listSubmissionsSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  desaId: z.number().int().positive().optional(),
  kecamatan: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortKey: submissionSortKeySchema.optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  /** Ask where this row sits, so the client can jump to its page. */
  focusId: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).default(10),
  offset: z.number().int().nonnegative().default(0),
});

export const listDocumentsSchema = z.object({
  category: fileCategoryEnum.optional(),
  isTemporary: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});

// ============================================================================
// Template Schemas
// ============================================================================

export const getTemplateUrlSchema = z.object({
  templateType: z.enum(
     [
      'surat_pernyataan_permohonan.pdf',
      'surat_pernyataan_tidak_sengketa.docx',
      'berita_acara_validasi_lapangan.docx',
      'spptg_template.pdf',
    ],
  )});
