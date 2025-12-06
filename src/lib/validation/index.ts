import { z } from 'zod';
export * from './submission-draft';

// ============================================================================
// User Schemas
// ============================================================================

export const createUserSchema = z.object({
  email: z.string().email('Email tidak valid'),
  nama: z.string().min(2, 'Nama minimal 2 karakter'),
  nipNik: z
    .string()
    .min(5, 'NIP/NIK minimal 5 karakter')
    .max(20, 'NIP/NIK maksimal 20 karakter'),
  peran: z.enum(['Superadmin', 'Admin', 'Verifikator', 'Viewer']).optional(),
});

export const updateUserSchema = createUserSchema.partial();

// ============================================================================
// Village Schemas
// ============================================================================

export const createVillageSchema = z.object({
  kodeDesa: z.string().min(1, 'Kode desa diperlukan'),
  namaDesa: z.string().min(2, 'Nama desa minimal 2 karakter'),
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
  jenisKawasan: z.enum([
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
  ]),
  sumberData: z.string().min(2, 'Sumber data minimal 2 karakter'),
  dasarHukum: z.string().optional(),
  tanggalEfektif: z.coerce.date(),
  diunggahOleh: z.number().int('User ID harus integer'),
  statusValidasi: z.enum(['Lolos', 'Perlu Perbaikan']).optional(),
  aktifDiValidasi: z.boolean().optional(),
  warna: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Warna harus format hex (contoh: #FF5733)'),
  catatan: z.string().optional(),
  geomGeoJSON: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number()))),
  }),
});

export const updateProhibitedAreaSchema = createProhibitedAreaSchema.partial();

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
    'Ditolak',
    'Ditinjau Ulang',
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

// ============================================================================
// Query Schemas
// ============================================================================

export const listSubmissionsSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});

export const listDocumentsSchema = z.object({
  category: fileCategoryEnum.optional(),
  isTemporary: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});