/**
 * PDF Types and Interfaces for SPPTG Document Generation
 * 
 * This file contains all TypeScript types and interfaces needed for the
 * React-PDF based SPPTG document generation system.
 */

import { GeographicCoordinate } from '@/types';

/**
 * Configuration options for PDF generation
 * Allows dynamic inclusion/exclusion of document sections
 */
export interface PDFGenerationConfig {
  /** Include witnesses table on page 2 */
  includeWitnesses: boolean;
  /** Include administrative section (Kepala Desa) on page 2 */
  includeAdministrative: boolean;
  /** Include map attachment on page 3 */
  includeMap: boolean;
  /** Optional custom header text */
  customHeader?: string;
}

/**
 * Complete data structure for SPPTG PDF generation
 * Contains all fields that can be filled in the document
 */
export interface SPPTGPDFData {
  // Personal Information
  /** Full name of the applicant */
  namaPemohon: string;
  /** National ID number (16 digits) */
  nik: string;
  /** Place of birth */
  tempatLahir?: string;
  /** Date of birth (ISO date string) */
  tanggalLahir?: string;
  /** Occupation */
  pekerjaan?: string;
  /** Address as per KTP */
  alamatKTP?: string;

  // Land Information
  /** Manual land area input in m² */
  luasManual?: number;
  /** Land area in Indonesian words */
  luasTerbilang: string;
  /** Calculated land area from polygon in m² */
  luasLahan?: number;
  /** Land use type */
  penggunaanLahan?: string;
  /** Year cultivation started */
  tahunAwalGarap?: number;

  // Location Details
  /** Street name */
  namaJalan?: string;
  /** Alley/Gang name */
  namaGang?: string;
  /** Plot number */
  nomorPersil?: string;
  /** RT/RW number */
  rtrw?: string;
  /** Hamlet name */
  dusun?: string;
  /** Village name */
  namaDesa: string;
  /** District name */
  kecamatan: string;
  /** Regency name */
  kabupaten: string;

  // Boundary Information (8 directions: 4 cardinal + 4 intercardinal)
  /** North boundary direction */
  batasUtara?: string;
  /** North boundary land use */
  penggunaanBatasUtara?: string;
  /** Northeast boundary direction */
  batasTimurLaut?: string;
  /** Northeast boundary land use */
  penggunaanBatasTimurLaut?: string;
  /** East boundary direction */
  batasTimur?: string;
  /** East boundary land use */
  penggunaanBatasTimur?: string;
  /** Southeast boundary direction */
  batasTenggara?: string;
  /** Southeast boundary land use */
  penggunaanBatasTenggara?: string;
  /** South boundary direction */
  batasSelatan?: string;
  /** South boundary land use */
  penggunaanBatasSelatan?: string;
  /** Southwest boundary direction */
  batasBaratDaya?: string;
  /** Southwest boundary land use */
  penggunaanBatasBaratDaya?: string;
  /** West boundary direction */
  batasBarat?: string;
  /** West boundary land use */
  penggunaanBatasBarat?: string;
  /** Northwest boundary direction */
  batasBaratLaut?: string;
  /** Northwest boundary land use */
  penggunaanBatasBaratLaut?: string;

  // Witnesses (1-4 witnesses)
  /** List of boundary witnesses */
  saksiList: Array<{
    /** Witness name */
    nama: string;
    /** Boundary side (Utara, Timur, Selatan, Barat, etc.) */
    sisi: string;
    /** Land use at this boundary */
    penggunaanLahanBatas?: string;
  }>;

  // Administrative Information
  /** SPPTG registration number */
  nomorSPPTG: string;
  /** Statement date */
  tanggalPernyataan: string;
  /** Village head name */
  namaKepalaDesa?: string;

  // Map Data
  /** Geographic coordinates of land polygon */
  coordinatesGeografis: GeographicCoordinate[];
  /** URL to map image (Google Maps Static API) */
  mapImageUrl?: string;
}

/**
 * Props for individual page components
 */
export interface PageProps {
  data: SPPTGPDFData;
  config?: PDFGenerationConfig;
}

/**
 * Font registration configuration
 */
export interface FontConfig {
  family: string;
  fonts: Array<{
    src: string;
    fontStyle?: string;
    fontWeight?: number;
  }>;
}

/**
 * Style definitions for PDF components
 */
export interface PDFStyles {
  page: Record<string, unknown>;
  section: Record<string, unknown>;
  title: Record<string, unknown>;
  subtitle: Record<string, unknown>;
  text: Record<string, unknown>;
  label: Record<string, unknown>;
  value: Record<string, unknown>;
  table: Record<string, unknown>;
  tableCell: Record<string, unknown>;
  tableHeader: Record<string, unknown>;
  footer: Record<string, unknown>;
  signature: Record<string, unknown>;
}

/**
 * Result of PDF generation
 */
export interface PDFGenerationResult {
  /** Generated PDF as Blob */
  blob: Blob;
  /** URL for previewing the PDF */
  url: string;
  /** PDF size in bytes */
  size: number;
  /** Base64 encoded PDF data */
  base64: string;
}

/**
 * Hook return type for PDF generation
 */
export interface UsePDFGeneratorReturn {
  /** Generate PDF from data */
  generatePDF: (data: SPPTGPDFData, config?: PDFGenerationConfig) => Promise<PDFGenerationResult>;
  /** Loading state */
  isGenerating: boolean;
  /** Error if any */
  error: Error | null;
  /** Clear error */
  clearError: () => void;
}

/**
 * Button component props
 */
export interface PDFDownloadButtonProps {
  /** Data to fill in the PDF */
  data: SPPTGPDFData;
  /** Configuration for PDF generation */
  config?: PDFGenerationConfig;
  /** Button text */
  children?: React.ReactNode;
  /** Callback when PDF is generated */
  onGenerate?: (result: PDFGenerationResult) => void;
  /** Callback when download starts */
  onDownload?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Filename for download */
  filename?: string;
}
