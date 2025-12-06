import { z } from 'zod';

// ============================================================================
// SHARED TYPES & SCHEMAS
// ============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export const uploadedDocumentSchema = z.object({
  name: z.string().min(1, 'Nama file diperlukan'),
  size: z.number().int().positive('Ukuran file tidak valid'),
  url: z.string().url('URL tidak valid').optional(),
  uploadedAt: z.string().datetime().optional(),
  documentId: z.number().int().optional(), // Reference to DB row
});

export type UploadedDocument = z.infer<typeof uploadedDocumentSchema>;

export const researchTeamMemberSchema = z.object({
  nama: z.string().min(2, 'Nama minimal 2 karakter'),
  jabatan: z.string().min(2, 'Jabatan minimal 2 karakter'),
  instansi: z.string().optional(),
  nomorHP: z
    .string()
    .regex(/^(\+62|0)[0-9]{9,12}$/, 'Nomor HP tidak valid'),
});

export type ResearchTeamMember = z.infer<typeof researchTeamMemberSchema>;

export const boundaryWitnessSchema = z.object({
  id: z.string().uuid().optional(), // Client-generated
  nama: z.string().min(2, 'Nama minimal 2 karakter'),
  sisi: z.enum(['Utara', 'Timur', 'Selatan', 'Barat'],{
    error: (e) => ({ message: `value :${e.input} causes: ${e.message}` }),
  }),
});

export type BoundaryWitness = z.infer<typeof boundaryWitnessSchema>;

export const geographicCoordinateSchema = z.object({
  id: z.string().uuid().optional(),
  latitude: z
    .number()
    .min(-90, 'Latitude minimal -90')
    .max(90, 'Latitude maksimal 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude minimal -180')
    .max(180, 'Longitude maksimal 180'),
});

export type GeographicCoordinate = z.infer<typeof geographicCoordinateSchema>;

// ============================================================================
// STEP 1: BERKAS (Documents)
// ============================================================================

export const step1BerkasSchema = z.object({
  // Personal info
  namaPemohon: z
    .string()
    .min(2, 'Nama pemohon minimal 2 karakter')
    .max(255, 'Nama pemohon maksimal 255 karakter'),

  nik: z
    .string()
    .length(16, 'NIK harus 16 karakter')
    .regex(/^[0-9]{16}$/, 'NIK hanya boleh angka'),

  // Documents
  dokumenKTP: uploadedDocumentSchema.optional(),
  dokumenKK: uploadedDocumentSchema.optional(),
  dokumenKwitansi: uploadedDocumentSchema.optional(),
  dokumenPermohonan: uploadedDocumentSchema.optional(),

  // Consent
  persetujuanData: z.boolean({
    error: () => ({
      message: 'Anda harus menyetujui pernyataan data',
    }),
  }),
});

export type Step1Berkas = z.infer<typeof step1BerkasSchema>;

// ============================================================================
// STEP 2: LAPANGAN (Field Validation)
// ============================================================================

export const step2LapanganSchema = z.object({
  // Team members
  juruUkur: researchTeamMemberSchema.optional(),
  pihakBPD: researchTeamMemberSchema.optional(),
  kepalaDusun: researchTeamMemberSchema.optional(),
  rtSetempat: researchTeamMemberSchema.optional(),

  // Witnesses
  saksiList: z
    .array(boundaryWitnessSchema)
    .min(1, 'Minimal 1 saksi diperlukan')
    .max(4, 'Maksimal 4 saksi'),

  // Coordinates (Geographic only)
  coordinatesGeografis: z
    .array(geographicCoordinateSchema)
    .min(3, 'Minimal 3 koordinat untuk membentuk polygon')
    .max(100, 'Maksimal 100 koordinat'),

  // Calculated fields
  luasLahan: z
    .number()
    .positive('Luas lahan harus positif')
    .optional(),

  kelilingLahan: z
    .number()
    .positive('Keliling lahan harus positif')
    .optional(),

  // Documents
  dokumenBeritaAcara: uploadedDocumentSchema.optional(),
  dokumenAsalUsul: uploadedDocumentSchema.optional(),
  dokumenPernyataanJualBeli: uploadedDocumentSchema.optional(),
  dokumenTidakSengketa: uploadedDocumentSchema.optional(),

  // Photos
  fotoLahan: z
    .array(uploadedDocumentSchema)
    .min(1, 'Minimal 1 foto lapangan diperlukan')
    .max(10, 'Maksimal 10 foto'),
});

export type Step2Lapangan = z.infer<typeof step2LapanganSchema>;

// ============================================================================
// STEP 3: HASIL (Results / Verification)
// ============================================================================

export const feedbackDataSchema = z.object({
  alasanTerpilih: z
    .array(z.string())
    .min(1, 'Minimal 1 alasan harus dipilih'),

  dokumenTidakLengkap: z.array(z.string()).optional(),

  detailFeedback: z
    .string()
    .min(10, 'Detail feedback minimal 10 karakter')
    .max(1000, 'Detail feedback maksimal 1000 karakter'),

  tanggalTenggat: z.string().datetime().optional(),

  lampiranFeedback: uploadedDocumentSchema.optional(),

  timestamp: z.string().datetime().optional(),

  pemberi: z.string().min(2, 'Nama pemberi feedback minimal 2 karakter'),
});

export type FeedbackData = z.infer<typeof feedbackDataSchema>;

export const step3HasilSchema = z.object(z.object({
      status: z.enum(['SPPTG terdata', 'SPPTG terdaftar']),
      verifikator: z.number().int('Verifikator harus ditentukan'),
    })).or(
      z.object({
      status: z.enum(['Ditolak', 'Ditinjau Ulang']),
      alasanStatus: z
        .string()
        .min(10, 'Alasan penolakan minimal 10 karakter')
        .max(1000, 'Alasan penolakan maksimal 1000 karakter'),
      feedback: feedbackDataSchema,
      verifikator: z.number().int('Verifikator harus ditentukan'),
    }),
    )
  .refine(
    (data) => {
      // Ensure verifikator is present (from context, not in this schema)
      return true;
    },
    {
      message: 'Verifikator harus ditentukan',
    }
  )

export type Step3Hasil = z.infer<typeof step3HasilSchema>;

// ============================================================================
// STEP 4: ISSUANCE (Penerbitan SPPTG)
// ============================================================================

export const step4IssuanceSchema = z.object({
  dokumenSPPTG: uploadedDocumentSchema.optional(),

  nomorSPPTG: z
    .string()
    .min(5, 'Nomor SPPTG minimal 5 karakter')
    .max(50, 'Nomor SPPTG maksimal 50 karakter')
    .optional(),

  tanggalTerbit: z.string().datetime().optional(),
});

export type Step4Issuance = z.infer<typeof step4IssuanceSchema>;

// ============================================================================
// FULL SUBMISSION DRAFT PAYLOAD
// ============================================================================

export const submissionDraftPayloadSchema = z.object({
  // Metadata
  currentStep: z.number().int().min(1).max(4),
  lastSaved: z.string().datetime().optional(),

  // Step 1 data
  namaPemohon: z.string(),
  nik: z.string(),
  dokumenKTP: uploadedDocumentSchema,
  dokumenKK: uploadedDocumentSchema,
  dokumenKwitansi: uploadedDocumentSchema.optional(),
  dokumenPermohonan: uploadedDocumentSchema.optional(),
  persetujuanData: z.boolean().optional(),

  // Step 2 data
  juruUkur: researchTeamMemberSchema.optional(),
  pihakBPD: researchTeamMemberSchema.optional(),
  kepalaDusun: researchTeamMemberSchema.optional(),
  rtSetempat: researchTeamMemberSchema.optional(),
  saksiList: z.array(boundaryWitnessSchema).default([]),
  coordinatesGeografis: z.array(geographicCoordinateSchema).default([]),
  luasLahan: z.number().optional(),
  kelilingLahan: z.number().optional(),
  dokumenBeritaAcara: uploadedDocumentSchema.optional(),
  dokumenAsalUsul: uploadedDocumentSchema.optional(),
  dokumenPernyataanJualBeli: uploadedDocumentSchema.optional(),
  dokumenTidakSengketa: uploadedDocumentSchema.optional(),
  fotoLahan: z.array(uploadedDocumentSchema).default([]),

  // Step 3 data
  status: z
    .enum(['SPPTG terdata', 'SPPTG terdaftar', 'Ditolak', 'Ditinjau Ulang'])
    .optional(),
  alasanStatus: z.string().optional(),
  verifikator: z.number().int(),
  feedback: feedbackDataSchema.optional(),

  // Step 4 data
  dokumenSPPTG: uploadedDocumentSchema.optional(),
  nomorSPPTG: z.string().optional(),
  tanggalTerbit: z.string().datetime().optional(),

  // Computed overlaps (read-only)
  overlapResults: z
    .array(
      z.object({
        kawasanId: z.number().int(),
        namaKawasan: z.string(),
        jenisKawasan: z.string(),
        luasOverlap: z.number(),
        percentageOverlap: z.number().optional(),
      })
    )
    .default([]),
});

export type SubmissionDraftPayload = z.infer<
  typeof submissionDraftPayloadSchema
>;

// ============================================================================
// STEP-SPECIFIC SAVE SCHEMAS (for validation per step)
// ============================================================================

export const saveStep1Schema = z.object({
  draftId: z.number().int(),
  currentStep: z.literal(1),
  payload: step1BerkasSchema,
});

export type SaveStep1 = z.infer<typeof saveStep1Schema>;

export const saveStep2Schema = z.object({
  draftId: z.number().int(),
  currentStep: z.literal(2),
  payload: step2LapanganSchema,
});

export type SaveStep2 = z.infer<typeof saveStep2Schema>;

export const saveStep3Schema = z.object({
  draftId: z.number().int(),
  currentStep: z.literal(3),
  payload: step3HasilSchema
});

export type SaveStep3 = z.infer<typeof saveStep3Schema>;

export const saveStep4Schema = z.object({
  draftId: z.number().int(),
  currentStep: z.literal(4),
  payload: step4IssuanceSchema,
});

export type SaveStep4 = z.infer<typeof saveStep4Schema>;

// Union type for all step saves
export const saveDraftStepSchema = z.discriminatedUnion('currentStep', [
  saveStep1Schema,
  saveStep2Schema,
  saveStep3Schema,
  saveStep4Schema,
]);

export type SaveDraftStep = z.infer<typeof saveDraftStepSchema>;

// ============================================================================
// VALIDATION FOR STEP COMPLETION
// ============================================================================

/**
 * Validate if a step is complete enough to move to next step
 */
export function validateStepCompletion(
  step: number,
  payload: object
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    switch (step) {
      case 1:
        step1BerkasSchema.parse(payload);
        break;
      case 2:
        step2LapanganSchema.parse(payload);
        break;
      case 3:
        step3HasilSchema.parse(payload);
        // if (!payload.verifikator) {
        //   errors.push('Verifikator harus ditentukan');
        // }
        break;
      case 4:
        step4IssuanceSchema.parse(payload);
        break;
      default:
        errors.push('Step tidak valid');
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      error._zod.def.forEach((err) => {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}