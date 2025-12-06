import { type users } from "@/server/db/schema";

export type StatusSPPTG = 'SPPTG terdaftar' | 'SPPTG terdata' | 'SPPTG ditolak' | 'SPPTG ditinjau ulang';

export interface Submission {
  id: string;
  // Data Pemilik
  namaPemilik: string;
  nik: string;
  alamat: string;
  nomorHP: string;
  email: string;
  
  // Data Lahan
  desa: string;
  kecamatan: string;
  kabupaten: string;
  luas: number; // m²
  penggunaanLahan: string;
  catatan?: string;
  
  // Peta & Dokumen
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  geoJSON?: string | {}; 
  coordinates?: [number, number][];
  dokumen?: File | string;
  
  // Status
  status: StatusSPPTG;
  tanggalPengajuan: string;
  verifikator?: string;
  
  // Riwayat
  riwayat: StatusHistory[];
  
  // Feedback
  feedback?: FeedbackData;
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
  terdaftar: number;
  terdata: number;
  ditolak: number;
  ditinjauUlang: number;
  total: number;
}

export type UserRole = (typeof users.$inferInsert)["peran"]
export type UserStatus = 'Aktif' | 'Nonaktif';

export interface User {
  id: string;
  nama: string;
  nipNik: string;
  email: string;
  peran: UserRole;
  status: UserStatus;
  nomorHP?: string;
  terakhirMasuk?: string;
}

export interface Village {
  id: string;
  kodeDesa: string; // BPS code
  namaDesa: string;
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
  id: string;
  namaKawasan: string;
  jenisKawasan: ProhibitedAreaType;
  sumberData: string;
  dasarHukum?: string;
  tanggalEfektif: string;
  tanggalUnggah: string;
  diunggahOleh: string;
  statusValidasi: ValidationStatus;
  aktifDiValidasi: boolean;
  warna: string;
  catatan?: string;
  coordinates?: [number, number][];
  fileUrl?: string;
}

// Submission Flow Types
export type CoordinateSystem = 'geografis' | 'utm';
export type BoundaryDirection = 'Utara' | 'Timur' | 'Selatan' | 'Barat';

export interface UploadedDocument {
  name: string;
  size: number;
  url?: string;
  uploadedAt?: string;
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
  kawasanId: string;
  namaKawasan: string;
  jenisKawasan: string;
  luasOverlap: number; // m²
}

export interface SubmissionDraft {
  id?: string;
  currentStep: number;
  lastSaved?: string;
  
  // Step 1: Documents
  namaPemohon: string;
  nik: string;
  dokumenKTP?: UploadedDocument;
  dokumenKK?: UploadedDocument;
  dokumenKwitansi?: UploadedDocument;
  dokumenPermohonan?: UploadedDocument;
  dokumenSKKepalaDesa?: UploadedDocument;
  persetujuanData: boolean;
  
  // Step 2: Field Validation
  juruUkur?: ResearchTeamMember;
  pihakBPD?: ResearchTeamMember;
  kepalaDusun?: ResearchTeamMember;
  rtSetempat?: ResearchTeamMember;
  saksiList: BoundaryWitness[];
  
  coordinateSystem: CoordinateSystem;
  coordinatesGeografis: GeographicCoordinate[];
  coordinatesUTM: UTMCoordinate[];
  
  fotoLahan: UploadedDocument[];
  dokumenBeritaAcara?: UploadedDocument;
  dokumenPernyataanJualBeli?: UploadedDocument;
  dokumenAsalUsul?: UploadedDocument;
  dokumenTidakSengketa?: UploadedDocument;
  
  overlapResults: OverlapResult[];
  luasLahan?: number; // m² calculated from polygon
  kelilingLahan?: number; // m
  
  // Step 3: Results
  status?: StatusSPPTG;
  alasanStatus?: string;
  verifikator?: string;
  tanggalKeputusan?: string;
  feedback?: FeedbackData;
  
  // Step 4: Issuance
  dokumenSPPTG?: UploadedDocument;
  nomorSPPTG?: string;
  tanggalTerbit?: string;
}
