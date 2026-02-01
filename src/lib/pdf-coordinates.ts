/**
 * PDF Coordinate Configuration for SPPTG Certificate Template
 * 
 * X, Y coordinates are in PDF points (1 point = 1/72 inch)
 * Y coordinates are specified as distance from TOP of page (will be converted to bottom-left origin by pdf-generator.ts)
 * X coordinates are distance from LEFT edge of page
 * 
 * The code in pdf-generator.ts converts Y coordinates: adjustedY = PDF_PAGE_SIZE.height - y
 * So if you want text at 100 points from top, specify y: 100
 */

export interface PDFFieldCoordinates {
  x: number;
  y: number;
  fontSize?: number;
  font?: 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Times-Bold';
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
}

/**
 * Default page dimensions (A4: 595 x 842 points)
 */
export const PDF_PAGE_SIZE = {
  width: 595,
  height: 842,
};

/**
 * Coordinate mappings for SPPTG certificate fields
 * Based on the actual template PDF structure across 3 pages
 * 
 * Page 1: Personal info, land location, land measurements, boundaries
 * Page 2: Statement continuation, witnesses table, signatures, administrative
 * Page 3: Map attachment
 */
export const SPPTG_FIELD_COORDINATES: Record<string, PDFFieldCoordinates & { page?: number }> = {
  // Page 1 - Personal Information Section
  // Values appear after the colon (around x: 245)
  namaPemohon: {
    x: 245,
    y: 107,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 0,
  },
  
  nik: {
    x: 245,
    y: 122,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 0,
  },
  
  tempatTanggalLahir: {
    x: 245,
    y: 137,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 350,
    page: 0,
  },
  
  pekerjaan: {
    x: 245,
    y: 152,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 0,
  },
  
  alamatKTP: {
    x: 245,
    y: 167,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 400,
    page: 0,
  },
  
  // Page 1 - Land Location Section (Statement 1.a)
  // Values appear after the colon (around x: 245)
  namaJalan: {
    x: 245,
    y: 232,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 0,
  },
  
  namaGang: {
    x: 245,
    y: 247,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 0,
  },
  
  nomorPersil: {
    x: 245,
    y: 262,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 150,
    page: 0,
  },
  
  rtrw: {
    x: 245,
    y: 277,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 150,
    page: 0,
  },
  
  dusun: {
    x: 245,
    y: 292,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 250,
    page: 0,
  },
  
  namaDesa: {
    x: 245,
    y: 307,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 0,
  },
  
  kecamatan: {
    x: 245,
    y: 322,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 0,
  },
  
  kabupaten: {
    x: 245,
    y: 337,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 0,
  },
  
  // Page 1 - Land Measurements Section (Statement 1.b)
  // luasManual appears inline in statement AND in measurement section
  luasManual: {
    x: 270,
    y: 367,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 150,
    page: 0,
  },
  
  // luasTerbilang appears inline within the statement text
  luasTerbilang: {
    x: 270,
    y: 355,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 400,
    page: 0,
  },
  
  luasLahan: {
    x: 270,
    y: 382,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 150,
    page: 0,
  },
  
  // Page 1 - Boundary Directions (4 directions with usage)
  // Each boundary has direction and usage side by side
  batasUtara: {
    x: 85,
    y: 397,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 120,
    page: 0,
  },
  
  penggunaanBatasUtara: {
    x: 220,
    y: 397,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 250,
    page: 0,
  },
  
  batasTimur: {
    x: 85,
    y: 412,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 120,
    page: 0,
  },
  
  penggunaanBatasTimur: {
    x: 220,
    y: 412,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 250,
    page: 0,
  },
  
  batasSelatan: {
    x: 85,
    y: 427,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 120,
    page: 0,
  },
  
  penggunaanBatasSelatan: {
    x: 220,
    y: 427,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 250,
    page: 0,
  },
  
  batasBarat: {
    x: 85,
    y: 442,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 120,
    page: 0,
  },
  
  penggunaanBatasBarat: {
    x: 220,
    y: 442,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 250,
    page: 0,
  },
  
  // Page 1 - Land Use and Year
  penggunaanLahan: {
    x: 270,
    y: 460,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 0,
  },
  
  // tahunAwalGarap appears mid-sentence in statement 2
  tahunAwalGarap: {
    x: 480,
    y: 515,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 100,
    page: 0,
  },
  
  // Page 2 - Statement Date and Location
  // "Dibuat di [Nama Desa] pada tanggal [Tanggal Pernyataan]"
  namaDesaPernyataan: {
    x: 200,
    y: 110,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  tanggalPernyataan: {
    x: 380,
    y: 110,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  // Page 2 - Signature Section
  // "Yang membuat pernyataan" followed by name
  namaPemohonSignature: {
    x: 85,
    y: 170,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 1,
  },
  
  // Page 2 - Witnesses Table (2x2 grid)
  // Top-left cell (Witness 1)
  namaSaksi1: {
    x: 85,
    y: 230,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  batasSaksi1: {
    x: 85,
    y: 245,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  penggunaanSaksi1: {
    x: 85,
    y: 260,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  // Top-right cell (Witness 2)
  namaSaksi2: {
    x: 310,
    y: 230,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  batasSaksi2: {
    x: 310,
    y: 245,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  penggunaanSaksi2: {
    x: 310,
    y: 260,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  // Bottom-left cell (Witness 3)
  namaSaksi3: {
    x: 85,
    y: 310,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  batasSaksi3: {
    x: 85,
    y: 325,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  penggunaanSaksi3: {
    x: 85,
    y: 340,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  // Bottom-right cell (Witness 4)
  namaSaksi4: {
    x: 310,
    y: 310,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  batasSaksi4: {
    x: 310,
    y: 325,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  penggunaanSaksi4: {
    x: 310,
    y: 340,
    fontSize: 10,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  // Page 2 - Administrative Section
  // "Mengetahui" section with Nomor Registrasi, Tanggal, Kepala Desa
  nomorSPPTG: {
    x: 200,
    y: 385,
    fontSize: 11,
    font: 'Helvetica-Bold',
    align: 'left',
    maxWidth: 300,
    page: 1,
  },
  
  tanggalTerbit: {
    x: 150,
    y: 400,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 200,
    page: 1,
  },
  
  namaKepalaDesa: {
    x: 85,
    y: 450,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
    page: 1,
  },
};

/**
 * Get coordinates for a field
 */
export function getFieldCoordinates(fieldName: string): PDFFieldCoordinates & { page?: number } {
  const coords = SPPTG_FIELD_COORDINATES[fieldName];
  if (!coords) {
    throw new Error(`Coordinates not defined for field: ${fieldName}`);
  }
  return {
    ...coords,
    fontSize: coords.fontSize || 12,
    font: coords.font || 'Helvetica',
    align: coords.align || 'left',
    page: coords.page !== undefined ? coords.page : 0,
  };
}
