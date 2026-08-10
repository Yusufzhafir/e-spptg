/**
 * SPPTG Document Main Component
 * 
 * This is the main document component that combines all pages
 * of the SPPTG (Surat Pernyataan Penguasaan Tanah Garapan) document.
 * 
 * Usage:
 * ```tsx
 * import { PDFDownloadLink } from '@react-pdf/renderer';
 * import { SPPTGDocument } from './SPPTGDocument';
 * 
 * <PDFDownloadLink document={<SPPTGDocument data={data} config={config} />} fileName="SPPTG.pdf">
 *   Download PDF
 * </PDFDownloadLink>
 * ```
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import { SPPTGPage1 } from './SPPTGPage1';
import { SPPTGPage2 } from './SPPTGPage2';
import { SPPTGPage3 } from './SPPTGPage3';
import { SPPTGPage4 } from './SPPTGPage4';
import { SPPTGPageTerdataNotice } from './TerdataNotice';
import { isTerdataCertificate } from './pagination';
import { SPPTGPDFData, PDFGenerationConfig } from './types';
import { registerFonts } from './fonts';

// Register fonts on module load
registerFonts();

interface SPPTGDocumentProps {
  /** Data to populate the PDF fields */
  data: SPPTGPDFData;
  /** Configuration for PDF generation */
  config?: PDFGenerationConfig;
}

/**
 * Main SPPTG Document Component
 * 
 * Renders a complete SPPTG document with all sections.
 * The document includes:
 * - Page 1: Personal info, statement 1 (data fisik) with 8 boundary positions
 * - Page 2: Statements 2-14 and the closing statement
 * - Page 3: Declarant signature, witnesses table, administrative signature
 * - Page 4: Map attachment
 */
export const SPPTGDocument: React.FC<SPPTGDocumentProps> = ({
  data,
  config,
}) => {
  return (
    <Document>
      <SPPTGPage1 data={data} config={config} />
      <SPPTGPage2 data={data} config={config} />
      <SPPTGPage3 data={data} config={config} />
      {/* Terdata only: the disclosure notice sits between the signatures and
          the map, which is why the map page number is variant-dependent. */}
      {isTerdataCertificate(data) && (
        <SPPTGPageTerdataNotice data={data} config={config} />
      )}
      <SPPTGPage4 data={data} config={config} />
    </Document>
  );
};

export default SPPTGDocument;
