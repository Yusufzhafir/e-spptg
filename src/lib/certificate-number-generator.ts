/**
 * Certificate Number Generator for SPPTG
 * 
 * Format: SPPTG/{KODE_KABUPATEN}/{NOMOR_URUT}/{TAHUN}
 * Example: SPPTG/12.34/001/2025
 */

export interface CertificateNumberParts {
  kodeKabupaten: string; // e.g., "12.34"
  nomorUrut: string; // e.g., "001" (3 digits, zero-padded)
  tahun: string; // e.g., "2025"
}

/**
 * Generate a certificate number based on current year and sequence
 * 
 * @param sequenceNumber - Sequential number for the year (will be zero-padded to 3 digits)
 * @param kodeKabupaten - Regional code for the regency (default: "00.00" if not provided)
 * @returns Formatted certificate number string
 */
export function generateCertificateNumber(
  sequenceNumber: number,
  kodeKabupaten: string = '00.00'
): string {
  const currentYear = new Date().getFullYear();
  const nomorUrut = sequenceNumber.toString().padStart(3, '0');
  
  return `SPPTG/${kodeKabupaten}/${nomorUrut}/${currentYear}`;
}

/**
 * Parse a certificate number into its components
 * 
 * @param certificateNumber - Full certificate number string
 * @returns Parsed components or null if invalid format
 */
export function parseCertificateNumber(
  certificateNumber: string
): CertificateNumberParts | null {
  const pattern = /^SPPTG\/([0-9.]+)\/([0-9]+)\/([0-9]{4})$/;
  const match = certificateNumber.match(pattern);
  
  if (!match) {
    return null;
  }
  
  return {
    kodeKabupaten: match[1],
    nomorUrut: match[2],
    tahun: match[3],
  };
}

/**
 * Extract sequence number from certificate number
 * Useful for determining the next sequence number
 */
export function extractSequenceNumber(certificateNumber: string): number | null {
  const parsed = parseCertificateNumber(certificateNumber);
  if (!parsed) return null;
  
  return parseInt(parsed.nomorUrut, 10);
}

/**
 * Generate next certificate number based on existing numbers
 * 
 * @param existingNumbers - Array of existing certificate numbers from current year
 * @param kodeKabupaten - Regional code for the regency
 * @returns Next certificate number
 */
export function generateNextCertificateNumber(
  existingNumbers: string[],
  kodeKabupaten: string = '00.00'
): string {
  const currentYear = new Date().getFullYear();
  
  // Filter numbers from current year and extract sequence numbers
  const currentYearSequences = existingNumbers
    .map((num) => {
      const parsed = parseCertificateNumber(num);
      if (parsed && parsed.tahun === currentYear.toString()) {
        return parseInt(parsed.nomorUrut, 10);
      }
      return null;
    })
    .filter((seq): seq is number => seq !== null);
  
  // Get the maximum sequence number, or start from 1
  const nextSequence = currentYearSequences.length > 0
    ? Math.max(...currentYearSequences) + 1
    : 1;
  
  return generateCertificateNumber(nextSequence, kodeKabupaten);
}
