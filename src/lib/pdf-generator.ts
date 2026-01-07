import { PDFDocument, PDFFont, rgb, PDFPage } from 'pdf-lib';
import { getFieldCoordinates, PDF_PAGE_SIZE } from './pdf-coordinates';

/**
 * Field value mapping for PDF generation
 */
export interface PDFFormData {
  nomorSPPTG?: string;
  namaPemohon?: string;
  nik?: string;
  luasLahan?: number;
  tanggalTerbit?: string;
  villageName?: string;
  kecamatan?: string;
  kabupaten?: string;
  [key: string]: string | number | undefined;
}

/**
 * Load PDF template from URL and return as PDFDocument
 */
export async function loadPDFTemplate(templateUrl: string): Promise<PDFDocument> {
  try {
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    return pdfDoc;
  } catch (error) {
    throw new Error(`Error loading PDF template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load PDF template from base64 string and return as PDFDocument
 */
export async function loadPDFTemplateFromBase64(base64String: string): Promise<PDFDocument> {
  try {
    // Decode base64 to binary string
    const binaryString = atob(base64String);
    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pdfDoc = await PDFDocument.load(bytes);
    return pdfDoc;
  } catch (error) {
    throw new Error(`Error loading PDF template from base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Draw text on PDF page with proper alignment and wrapping
 */
function drawTextOnPage(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  text: string,
  coords: { x: number; y: number; fontSize?: number; font?: string; maxWidth?: number; align?: string }
): void {
  const fontSize = coords.fontSize || 12;
  const fontToUse = coords.font === 'Helvetica-Bold' ? boldFont : font;
  const x = coords.x;
  const y = coords.y;
  
  // PDF coordinates have origin at bottom-left, but we often think top-left
  // Adjust Y coordinate to account for this
  const adjustedY = PDF_PAGE_SIZE.height - y;
  
  // Handle text wrapping if maxWidth is specified
  if (coords.maxWidth && text) {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = fontToUse.widthOfTextAtSize(testLine, fontSize);
      
      if (width > coords.maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    // Draw each line
    lines.forEach((line, index) => {
      let textX = x;
      
      // Handle alignment
      if (coords.align === 'center') {
        const textWidth = fontToUse.widthOfTextAtSize(line, fontSize);
        textX = x - textWidth / 2;
      } else if (coords.align === 'right') {
        const textWidth = fontToUse.widthOfTextAtSize(line, fontSize);
        textX = x - textWidth;
      }
      
      page.drawText(line, {
        x: textX,
        y: adjustedY - (index * fontSize * 1.2), // Line spacing
        size: fontSize,
        font: fontToUse,
        color: rgb(0, 0, 0),
      });
    });
  } else {
    // Single line text
    let textX = x;
    
    if (coords.align === 'center') {
      const textWidth = fontToUse.widthOfTextAtSize(text, fontSize);
      textX = x - textWidth / 2;
    } else if (coords.align === 'right') {
      const textWidth = fontToUse.widthOfTextAtSize(text, fontSize);
      textX = x - textWidth;
    }
    
    page.drawText(text, {
      x: textX,
      y: adjustedY,
      size: fontSize,
      font: fontToUse,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * Fill PDF template with form data
 * 
 * @param templatePdf - Loaded PDF template document
 * @param formData - Data to fill into the PDF
 * @returns Filled PDF document
 */
export async function fillPDFTemplate(
  templatePdf: PDFDocument,
  formData: PDFFormData
): Promise<PDFDocument> {
  // Get the first page (assuming single-page certificate)
  const pages = templatePdf.getPages();
  if (pages.length === 0) {
    throw new Error('Template PDF has no pages');
  }
  
  const page = pages[0];
  
  // Embed fonts
  const helveticaFont = await templatePdf.embedFont('Helvetica');
  const helveticaBoldFont = await templatePdf.embedFont('Helvetica-Bold');
  
  // Fill in each field
  for (const [fieldName, value] of Object.entries(formData)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    try {
      const coords = getFieldCoordinates(fieldName);
      
      // Format value based on field type
      let displayValue = String(value);
      
      // Special formatting
      if (fieldName === 'luasLahan' && typeof value === 'number') {
        displayValue = `${value.toLocaleString('id-ID')} m²`;
      } else if (fieldName === 'tanggalTerbit' && typeof value === 'string') {
        // Format date
        try {
          const date = new Date(value);
          displayValue = date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        } catch {
          // Keep original value if date parsing fails
        }
      }
      
      drawTextOnPage(page, helveticaFont, helveticaBoldFont, displayValue, coords);
    } catch (error) {
      // Skip fields that don't have coordinates defined
      if (error instanceof Error && error.message.includes('Coordinates not defined')) {
        console.warn(`Skipping field ${fieldName}: ${error.message}`);
        continue;
      }
      throw error;
    }
  }
  
  return templatePdf;
}

/**
 * Generate filled PDF from template URL and form data
 * 
 * @param templateUrl - URL to fetch the PDF template
 * @param formData - Data to fill into the PDF
 * @returns PDF as Uint8Array (suitable for blob creation or upload)
 */
export async function generateFilledPDF(
  templateUrl: string,
  formData: PDFFormData
): Promise<Uint8Array> {
  // Load template
  const templatePdf = await loadPDFTemplate(templateUrl);
  
  // Fill template
  const filledPdf = await fillPDFTemplate(templatePdf, formData);
  
  // Save and return as bytes
  const pdfBytes = await filledPdf.save();
  return pdfBytes;
}

/**
 * Generate filled PDF from template base64 data and form data
 * This avoids CORS issues when accessing private S3 buckets
 * 
 * @param templateBase64 - Base64 encoded PDF template
 * @param formData - Data to fill into the PDF
 * @returns PDF as Uint8Array (suitable for blob creation or upload)
 */
export async function generateFilledPDFFromBase64(
  templateBase64: string,
  formData: PDFFormData
): Promise<Uint8Array> {
  // Load template from base64
  const templatePdf = await loadPDFTemplateFromBase64(templateBase64);
  
  // Fill template
  const filledPdf = await fillPDFTemplate(templatePdf, formData);
  
  // Save and return as bytes
  const pdfBytes = await filledPdf.save();
  return pdfBytes;
}

/**
 * Convert PDF bytes to base64 string
 */
export function pdfBytesToBase64(pdfBytes: Uint8Array): string {
  // Convert to base64
  const binary = Array.from(pdfBytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

/**
 * Create blob URL from PDF bytes (for preview/download)
 */
export function createPDFBlobUrl(pdfBytes: Uint8Array): string {
  // Create a copy as a regular ArrayBuffer to ensure type compatibility
  const buffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}
