import { submissions, submissions_documents, type users } from "@/server/db/schema";

export * from "@/lib/validation/submission-draft";

export type StatusSPPTG = ((typeof submissions.$inferSelect)["status"])

export type DocumentCategoryEnum = (typeof submissions_documents.$inferSelect)['category']

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
  kecamatan: string;
  kabupaten: string;
  luas: number; // m²
  luasManual?: number | null; // m² input manual
  penggunaanLahan: string;
  catatan: string | null;
  
  // Peta & Dokumen
  geoJSON?: any;
  
  // Status
  status: StatusSPPTG;
  tanggalPengajuan: Date;
  verifikator: number | null;
  
  // Riwayat
  riwayat: StatusHistory[];
  
  // Feedback
  feedback: FeedbackData | null;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
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
  total: number;
}

export type UserRole = (typeof users.$inferInsert)["peran"]
export type UserStatus = 'Aktif' | 'Nonaktif';

export interface User {
  id: number;
  clerkUserId: string;
  nama: string;
  nipNik: string;
  email: string;
  peran: UserRole;
  status: UserStatus;
  nomorHP: string | null;
  terakhirMasuk: Date | null;
}

export interface Village {
  id: number;
  kodeDesa: string; // BPS code
  namaDesa: string;
  namaKepalaDesa?: string | null;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  jumlahPengajuan: number;
}

export type ProhibitedAreaType = 
  | 'Hutan Lindung'
  | 'Tanah Pemerintah'
  | 'Cagar Alam'
  | 'Kawasan Industri'
  | 'Fasum/Fasos'
  | 'Sempadan Sungai'
  | 'Sempadan Pantai'
  | 'Kawasan Rawan Bencana'
  | 'Aset TNI/POLRI'
  | 'Lainnya';

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
  statusValidasi: ValidationStatus;
  aktifDiValidasi: boolean;
  warna: string;
  catatan: string | null;
  geomGeoJSON : string | null
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
  penggunaanLahanBatas?: string; // Land use at boundary
}

export interface GeographicCoordinate {
  id: string;
  latitude: number;
  longitude: number;
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
  namaKepalaDesa?: string; // Village head name
  
  juruUkur?: ResearchTeamMember;
  pihakBPD?: ResearchTeamMember;
  kepalaDusun?: ResearchTeamMember;
  rtSetempat?: ResearchTeamMember;
  saksiList: BoundaryWitness[];
  
  coordinateSystem: CoordinateSystem;
  coordinatesGeografis: GeographicCoordinate[];
  
  fotoLahan: UploadedDocument[];
  dokumenBeritaAcara?: UploadedDocument;
  dokumenPernyataanJualBeli?: UploadedDocument;
  dokumenAsalUsul?: UploadedDocument;
  dokumenTidakSengketa?: UploadedDocument;
  
  overlapResults: OverlapResult[];
  luasLahan?: number; // m² calculated from polygon
  luasManual?: number | null; // m² input manual
  kelilingLahan?: number; // m
  
  // Step 3: Results
  status?: StatusSPPTG;
  alasanStatus?: string;
  verifikator?: number;
  tanggalKeputusan?: string;
  feedback?: FeedbackData;
  
  // Step 4: Issuance
  dokumenSPPTG?: UploadedDocument;
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
