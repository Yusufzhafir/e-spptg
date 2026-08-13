import { submissions, submissions_documents, type users } from "@/server/db/schema";

export * from "@/lib/validation/submission-draft";

export type StatusSPPTG = ((typeof submissions.$inferSelect)["status"])

export type DocumentCategoryEnum = (typeof submissions_documents.$inferSelect)['category']

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

/**
 * A pengajuan may cover several separated bidang, so `submissions.geom` is a
 * MultiPolygon. Older rows were written as a plain Polygon and are still read
 * back as one — every consumer must accept both.
 */
export type SubmissionGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

export interface Submission {
  id: number;
  // Data Pemilik
  namaPemilik: string;
  nik: string;
  alamat: string;
  nomorHP: string;
  email: string;
  
  // Data Lahan
  villageId: number;
  /** Resolved village display name (null when the village no longer exists) */
  desaNama?: string | null;
  /** The desa's kecamatan; `kecamatan` above is stale free text. */
  desaKecamatan?: string | null;
  kecamatan: string;
  kabupaten: string;
  luas: number; // m²
  luasManual?: number | null; // m² input manual
  penggunaanLahan: string;
  catatan: string | null;
  
  // Peta & Dokumen
  geoJSON?: SubmissionGeometry | null;
  /**
   * Snapshot of the draft payload at submit time. Holds the applicant fields
   * the submissions table has no column for (tempat/tanggal lahir, pekerjaan,
   * alamat KTP), so the detail page can show the full owner record.
   */
  payload?: SubmissionPayloadSnapshot | null;

  // Status
  status: StatusSPPTG;
  // Validasi visual: true = data & polygon ditampilkan di peta, false = disembunyikan
  isValid: boolean;
  tanggalPengajuan: Date;
  ownerUserId: number | null;
  verifikator: number | null;
  /** Resolved verifikator display name (null when the user no longer exists) */
  verifikatorName?: string | null;
  
  // Riwayat
  riwayat: StatusHistory[];
  
  // Feedback
  feedback: FeedbackData | null;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The subset of the stored draft payload the UI reads back. It is a snapshot,
 * so every field is optional — older submissions predate some of them.
 */
export interface SubmissionPayloadSnapshot {
  namaPemohon?: string;
  nik?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  pekerjaan?: string;
  alamatKTP?: string;
  /** Field tape measurements from Step 2, in metres. */
  panjangLahan?: number;
  lebarLahan?: number;
  /**
   * Step 3 feedback. Newer submissions also have it in the `feedback` column;
   * this is the only place older rows carry it, so the detail page reads both.
   */
  feedback?: FeedbackData;
  [key: string]: unknown;
}

export interface StatusHistory {
  tanggal: string;
  status: StatusSPPTG;
  petugas: string;
  alasan?: string;
  feedback?: FeedbackData;
}

export interface FeedbackData {
  alasanTerpilih: string[];
  dokumenTidakLengkap?: string[];
  detailFeedback: string;
  tanggalTenggat?: string;
  lampiranFeedback?: UploadedDocument;
  timestamp: string;
  pemberi: string;
}

export interface KPIData {
  'SPPTG terdata': number;
  'SPPTG terdaftar': number;
  'SPPTG ditolak': number;
  'SPPTG ditinjau ulang': number;
  'Terbit SPPTG': number;
  total: number;
}

export type UserRole = (typeof users.$inferInsert)["peran"]
export type UserStatus = 'Aktif' | 'Nonaktif';

export interface User {
  id: number;
  /**
   * False for an account an admin created without an initial password: it exists
   * and has a role, but cannot sign in until the person follows the invite email
   * and chooses one. The hash itself never leaves the server.
   */
  hasPassword: boolean;
  nama: string;
  nipNik: string;
  email: string;
  peran: UserRole;
  assignedVillageId: number | null;
  /** Scope for the 'Kecamatan' role. */
  assignedKecamatan?: string | null;
  status: UserStatus;
  nomorHP: string | null;
  /** Signed link to the profile photo; null when the account has none. */
  fotoProfilUrl?: string | null;
  terakhirMasuk: Date | null;
  /** Last modification time, used as the default table sort. */
  updatedAt?: Date | string | null;
}

export interface Village {
  id: number;
  kodeDesa: string; // BPS code
  namaDesa: string;
  namaKepalaDesa?: string | null;
  juruUkurNama?: string | null;
  juruUkurJabatan?: string | null;
  juruUkurInstansi?: string | null;
  juruUkurNomorHP?: string | null;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  jumlahPengajuan: number;
  /** Last modification time, used as the default table sort. */
  updatedAt?: Date | string | null;
}

// Re-exported so the many `from '@/types'` importers keep working; the list
// itself lives in one place (see prohibited-area-types.ts).
import type { ProhibitedAreaType } from '@/lib/prohibited-area-types';
export type { ProhibitedAreaType };

export type ValidationStatus = 'Lolos' | 'Perlu Perbaikan';

export interface ProhibitedArea {
  id: number;
  namaKawasan: string;
  jenisKawasan: ProhibitedAreaType;
  sumberData: string;
  dasarHukum: string | null;
  tanggalEfektif: string;
  tanggalUnggah: string;
  diunggahOleh: number | null;
  diunggahOlehNama?: string | null;
  statusValidasi: ValidationStatus;
  aktifDiValidasi: boolean;
  warna: string;
  catatan: string | null;
  geomGeoJSON : string | null
  /** Last modification time, used as the default table sort. */
  updatedAt?: Date | string | null;
}

// Submission Flow Types
export type CoordinateSystem = 'geografis' | 'utm';
export type BoundaryDirection = 'Utara' | 'Timur' | 'Selatan' | 'Barat' | 'Timur Laut' | 'Tenggara'| 'Barat Daya' | 'Barat Laut';

export interface UploadedDocument {
  name: string;
  size: number;
  url?: string;
  uploadedAt?: string;
  documentId?: number;
}

export interface ResearchTeamMember {
  nama: string;
  jabatan: string;
  instansi?: string;
  nomorHP: string;
}

export interface BoundaryWitness {
  id: string;
  nama: string;
  sisi: BoundaryDirection;
  penggunaanLahanBatas: string; // Land use at boundary
  umur?: number; // Age, printed on the SPPTG witness block
  pekerjaan?: string; // Occupation, printed on the SPPTG witness block
  alamat?: string; // Address, printed on the SPPTG witness block
}

export interface GeographicCoordinate {
  id: string;
  latitude: number;
  longitude: number;
}

/**
 * One bidang of a pengajuan. Several of these make up a claim that covers
 * separated parcels — see `@/lib/land-polygons`.
 */
export interface LandPolygon {
  id: string;
  /** Free-text label, usually the KML placemark name. */
  nama?: string;
  coordinates: GeographicCoordinate[];
  /**
   * Imported from a geospatial file, so the vertices are the file's record and
   * are not editable — a wrong import is deleted and re-imported rather than
   * unlocked.
   */
  locked?: boolean;
}

export interface UTMCoordinate {
  id: string;
  zone: string;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
}

export interface OverlapResult {
  kawasanId: number | string; // Can be number from DB or string from mock
  namaKawasan: string;
  jenisKawasan: string;
  sumber?: 'ProhibitedArea' | 'Submission';
  luasOverlap: number; // m²
  percentageOverlap?: number;
}

export interface SubmissionDraft {
  id?: number;
  currentStep: number;
  lastSaved?: string;
  
  // Step 1: Documents
  namaPemohon: string;
  nik: string;
  tempatLahir?: string; // Place of birth
  tanggalLahir?: string; // Date of birth (ISO date string)
  pekerjaan?: string; // Occupation
  alamatKTP?: string; // KTP address
  nomorHP?: string; // Applicant phone number
  email?: string; // Applicant email
  dokumenKTP?: UploadedDocument;
  dokumenKK?: UploadedDocument;
  dokumenKwitansi?: UploadedDocument;
  dokumenPermohonan?: UploadedDocument;
  dokumenSKKepalaDesa?: UploadedDocument;
  persetujuanData: boolean;
  
  // Step 2: Field Validation
  villageId?: number; // Village ID
  namaJalan?: string; // Street name
  namaGang?: string; // Alley name
  nomorPersil?: string; // Plot number
  rtrw?: string; // RT/RW
  dusun?: string; // Hamlet
  kecamatan?: string; // District
  kabupaten?: string; // Regency
  penggunaanLahan?: string; // Land use
  tahunAwalGarap?: number; // Year cultivation started
  statusTanah?: string; // Land status (Tanah Negara / Tanah Ulayat / other)
  asalPerolehan?: string; // Where the land was acquired from
  tahunPerolehan?: number; // Year the land was acquired
  namaKepalaDesa?: string; // Village head name
  
  juruUkur?: ResearchTeamMember;
  pihakBPD?: ResearchTeamMember;
  kepalaDusun?: ResearchTeamMember;
  rtSetempat?: ResearchTeamMember;
  saksiList: BoundaryWitness[];
  
  coordinateSystem: CoordinateSystem;
  /**
   * Mirror of `polygons[0].coordinates`, kept for drafts filed before a
   * pengajuan could hold more than one bidang. Never write it on its own — use
   * `polygonsPatch` from `@/lib/land-polygons`.
   */
  coordinatesGeografis: GeographicCoordinate[];
  /** Every bidang of this pengajuan. Absent on pre-multi-polygon drafts. */
  polygons?: LandPolygon[];
  
  fotoLahan: UploadedDocument[];
  dokumenBeritaAcara?: UploadedDocument;
  dokumenPernyataanJualBeli?: UploadedDocument;
  dokumenAsalUsul?: UploadedDocument;
  dokumenTidakSengketa?: UploadedDocument;
  
  overlapResults: OverlapResult[];
  luasLahan?: number; // m² calculated from polygon
  luasManual?: number | null; // m² input manual
  kelilingLahan?: number; // m
  /** Tape measurement at the patok, in metres. Optional, printed on no document. */
  panjangLahan?: number;
  lebarLahan?: number;
  
  // Step 3: Results
  status?: StatusSPPTG;
  alasanStatus?: string;
  verifikator?: number;
  tanggalKeputusan?: string;
  feedback?: FeedbackData;
  
  // Step 4: Issuance
  dokumenSPPTG?: UploadedDocument;
  /** Optional parent certificate this SPPTG is derived from. */
  dokumenSPPTGInduk?: UploadedDocument;
  nomorSPPTG?: string;
  tanggalTerbit?: string;
}

export interface SubmissionDocument {
  id: number;
  filename: string;
  fileType: string;
  size: number;
  url: string;
  category: DocumentCategoryEnum;
  submissionId: number | null;
  draftId: number | null;
  uploadedBy: number;
  isTemporary: boolean;
  uploadedAt: Date;
}
