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
import { SPPTGCoordinatePage } from './SPPTGCoordinatePage';
import { SPPTGWitnessPage } from './SPPTGWitnessPage';
import { SPPTGPageTerdataNotice } from './TerdataNotice';
import { coordinateSheets, isTerdataCertificate, witnessSheets } from './pagination';
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
      {/* Saksi beyond what the signature page holds continue here, before
          anything else — they belong with the signatures they carry on from.
          Not gated on `includeWitnesses`: page numbers are computed from the
          data alone, so dropping these sheets by config would leave gaps in the
          numbering the footer cannot express. */}
      {witnessSheets(data).map((sheet) => (
        <SPPTGWitnessPage
          key={`saksi-${sheet.page}`}
          data={data}
          config={config}
          sheet={sheet}
        />
      ))}
      {/* Terdata only: the disclosure notice sits between the signatures and
          the map, which is why the map page number is variant-dependent. */}
      {isTerdataCertificate(data) && (
        <SPPTGPageTerdataNotice data={data} config={config} />
      )}
      <SPPTGPage4 data={data} config={config} />
      {/* Lampiran 2+: the boundary as lat/lon and UTM, one sheet per bidang
          (split further when a bidang has more points than a sheet holds).
          Nomor persil and the measurements of each bidang are stated on page 1
          itself — a pengajuan covers at most two, which page 1 has room to name
          outright. */}
      {coordinateSheets(data).map((sheet) => (
        <SPPTGCoordinatePage
          key={`koordinat-${sheet.page}`}
          data={data}
          config={config}
          sheet={sheet}
          attachmentNumber={2}
        />
      ))}
    </Document>
  );
};

export default SPPTGDocument;
