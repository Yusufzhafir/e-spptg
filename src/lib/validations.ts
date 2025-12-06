import { z } from 'zod';

// ============================================================================
// User Schemas
// ============================================================================

export const createUserSchema = z.object({
  email: z.email(),
  nama: z.string().min(2),
  nipNik: z.string().min(5),
  peran: z.enum(['Superadmin', 'Admin', 'Verifikator', 'Viewer']).optional(),
});

export const updateUserSchema = createUserSchema.partial();

// ============================================================================
// Village Schemas
// ============================================================================

export const createVillageSchema = z.object({
  kodeDesa: z.string().min(1),
  namaDesa: z.string().min(2),
  kecamatan: z.string().min(2),
  kabupaten: z.string().min(2),
  provinsi: z.string().min(2),
});

export const updateVillageSchema = createVillageSchema.partial();

// ============================================================================
// Prohibited Area Schemas
// ============================================================================

export const createProhibitedAreaSchema = z.object({
  namaKawasan: z.string().min(2),
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
  sumberData: z.string().min(2),
  dasarHukum: z.string().optional(),
  tanggalEfektif: z.coerce.date(),
  diunggahOleh: z.number().int(),
  statusValidasi: z.enum(['Lolos', 'Perlu Perbaikan']).optional(),
  aktifDiValidasi: z.boolean().optional(),
  warna: z.string().regex(/^#[0-9A-F]{6}$/i),
  catatan: z.string().optional(),
  geomGeoJSON: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number()))),
  }),
});

export const updateProhibitedAreaSchema = createProhibitedAreaSchema.partial();

// ============================================================================
// Submission Draft Schemas
// ============================================================================

export const geographicCoordinateSchema = z.object({
  id: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const utmCoordinateSchema = z.object({
  id: z.string(),
  zone: z.string(),
  hemisphere: z.enum(['N', 'S']),
  easting: z.number(),
  northing: z.number(),
});

export const boundaryWitnessSchema = z.object({
  id: z.string(),
  nama: z.string().min(2),
  sisi: z.enum(['Utara', 'Timur', 'Selatan', 'Barat']),
});

export const researchTeamMemberSchema = z.object({
  nama: z.string().min(2),
  jabatan: z.string().min(2),
  instansi: z.string().optional(),
  nomorHP: z.string().min(10),
});

export const uploadedDocumentSchema = z.object({
  name: z.string(),
  size: z.number().int().positive(),
  url: z.string().url().optional(),
  uploadedAt: z.string().datetime().optional(),
});

export const submissionDraftSchema = z.object({
  id: z.number().int().optional(),
  currentStep: z.number().int().min(1).max(4),
  lastSaved: z.string().datetime().optional(),
  
  // Step 1: Documents
  namaPemohon: z.string().min(2),
  nik: z.string().length(16),
  dokumenKTP: uploadedDocumentSchema.optional(),
  dokumenKK: uploadedDocumentSchema.optional(),
  dokumenKwitansi: uploadedDocumentSchema.optional(),
  dokumenPermohonan: uploadedDocumentSchema.optional(),
  dokumenSKKepalaDesa: uploadedDocumentSchema.optional(),
  persetujuanData: z.boolean(),
  
  // Step 2: Field Validation
  juruUkur: researchTeamMemberSchema.optional(),
  pihakBPD: researchTeamMemberSchema.optional(),
  kepalaDusun: researchTeamMemberSchema.optional(),
  rtSetempat: researchTeamMemberSchema.optional(),
  saksiList: z.array(boundaryWitnessSchema).default([]),
  
  coordinateSystem: z.enum(['geografis', 'utm']),
  coordinatesGeografis: z.array(geographicCoordinateSchema).default([]),
  coordinatesUTM: z.array(utmCoordinateSchema).default([]),
  
  fotoLahan: z.array(uploadedDocumentSchema).default([]),
  dokumenBeritaAcara: uploadedDocumentSchema.optional(),
  dokumenPernyataanJualBeli: uploadedDocumentSchema.optional(),
  dokumenAsalUsul: uploadedDocumentSchema.optional(),
  dokumenTidakSengketa: uploadedDocumentSchema.optional(),
  
  overlapResults: z.array(z.any()).default([]),
  luasLahan: z.number().positive().optional(),
  kelilingLahan: z.number().positive().optional(),
  
  // Step 3: Results
  status: z.enum(['SPPTG terdata', 'SPPTG terdaftar', 'Ditolak', 'Ditinjau Ulang', 'Terbit SPPTG']).optional(),
  alasanStatus: z.string().optional(),
  verifikator: z.number().int().optional(),
  tanggalKeputusan: z.string().datetime().optional(),
  feedback: z.any().optional(),
  
  // Step 4: Issuance
  dokumenSPPTG: uploadedDocumentSchema.optional(),
  nomorSPPTG: z.string().optional(),
  tanggalTerbit: z.string().datetime().optional(),
});

export const saveDraftStepSchema = z.object({
  draftId: z.number().int(),
  currentStep: z.number().int().min(1).max(4),
  payload: z.any(),
});

// ============================================================================
// Submission Schemas
// ============================================================================

export const createSubmissionFromDraftSchema = z.object({
  draftId: z.number().int(),
});

export const updateSubmissionStatusSchema = z.object({
  submissionId: z.number().int(),
  newStatus: z.enum(['SPPTG terdata', 'SPPTG terdaftar', 'Ditolak', 'Ditinjau Ulang', 'Terbit SPPTG']),
  alasan: z.string().optional(),
  feedback: z.any().optional(),
});

// ============================================================================
// Document Schemas
// ============================================================================

export const createUploadUrlSchema = z.object({
  draftId: z.number().int(),
  category: z.enum([
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
  ]),
  filename: z.string().min(1),
  size: z.number().int().positive(),
  mimeType: z.string(),
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
  category: z.string().optional(),
  isTemporary: z.boolean().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});