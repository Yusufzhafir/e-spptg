/**
 * PDF Coordinate Configuration for SPPTG Certificate Template
 * 
 * X, Y coordinates are in PDF points (1 point = 1/72 inch)
 * Origin (0, 0) is at the bottom-left corner of the page
 * 
 * To find coordinates:
 * 1. Open PDF template in a PDF viewer that shows coordinates
 * 2. Use tools like Adobe Acrobat's "Measure Tool" or PDF.js coordinate system
 * 3. Adjust these values based on your template layout
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
 * Adjust these coordinates based on your template PDF
 */
export const SPPTG_FIELD_COORDINATES: Record<string, PDFFieldCoordinates> = {
  // Certificate Number
  nomorSPPTG: {
    x: 150,
    y: 750,
    fontSize: 12,
    font: 'Helvetica-Bold',
    align: 'left',
  },
  
  // Applicant Information
  namaPemohon: {
    x: 200,
    y: 650,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
  },
  
  nik: {
    x: 200,
    y: 630,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
  },
  
  // Land Information
  luasLahan: {
    x: 200,
    y: 570,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
  },
  
  // Date fields
  tanggalTerbit: {
    x: 400,
    y: 750,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
  },
  
  // Additional fields - adjust based on template
  villageName: {
    x: 200,
    y: 550,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
    maxWidth: 300,
  },
  
  kecamatan: {
    x: 200,
    y: 530,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
  },
  
  kabupaten: {
    x: 200,
    y: 510,
    fontSize: 11,
    font: 'Helvetica',
    align: 'left',
  },
};

/**
 * Get coordinates for a field
 */
export function getFieldCoordinates(fieldName: string): PDFFieldCoordinates {
  const coords = SPPTG_FIELD_COORDINATES[fieldName];
  if (!coords) {
    throw new Error(`Coordinates not defined for field: ${fieldName}`);
  }
  return {
    ...coords,
    fontSize: coords.fontSize || 12,
    font: coords.font || 'Helvetica',
    align: coords.align || 'left',
  };
}
