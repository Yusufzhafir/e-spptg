/**
 * PDF Styles Configuration for SPPTG Document
 * 
 * This file contains all style definitions for the React-PDF components.
 * Styles are designed to match the official Indonesian government document format.
 */

import { StyleSheet } from '@react-pdf/renderer';

// A4 Page dimensions in points (1 inch = 72 points)
export const PAGE_SIZE = {
  width: 595.28,  // A4 width
  height: 841.89, // A4 height
};

// Page margins
export const MARGINS = {
  top: 50,
  bottom: 50,
  left: 50,
  right: 50,
};

// Font sizes
export const FONT_SIZES = {
  title: 14,
  subtitle: 12,
  text: 10,
  small: 9,
  footer: 8,
};

// Font families
export const FONTS = {
  serif: 'Times-Roman',
  serifBold: 'Times-Bold',
};

// Colors
export const COLORS = {
  black: '#000000',
  text: '#000000',
  border: '#000000',
};

/**
 * Main stylesheet for SPPTG PDF
 */
export const styles = StyleSheet.create({
  // Page layout
  page: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.text,
    paddingTop: MARGINS.top,
    paddingBottom: MARGINS.bottom,
    paddingLeft: MARGINS.left,
    paddingRight: MARGINS.right,
    lineHeight: 1.4,
  },

  // Section containers
  section: {
    marginBottom: 12,
  },

  // Title styling
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: FONT_SIZES.title,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 1.3,
  },

  // Subtitle/heading styling
  subtitle: {
    fontFamily: FONTS.serifBold,
    fontSize: FONT_SIZES.subtitle,
    marginBottom: 6,
    marginTop: 12,
  },

  // Regular text
  text: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.text,
    textAlign: 'justify',
    marginBottom: 6,
  },

  // Label text (for field labels)
  label: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.text,
    width: 120,
  },

  // Value text (for field values)
  value: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.text,
    flex: 1,
  },

  // Row layout for label-value pairs
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },

  // Colon separator
  colon: {
    width: 20,
    textAlign: 'center',
  },

  // Statement number styling
  statementNumber: {
    fontFamily: FONTS.serifBold,
    width: 20,
  },

  // Sub-statement letter (a, b, c, d)
  subStatementLetter: {
    fontFamily: FONTS.serif,
    width: 30,
    paddingLeft: 20,
  },

  // Statement content
  statementContent: {
    flex: 1,
    textAlign: 'justify',
  },

  // Table styling
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
    marginBottom: 8,
  },

  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  tableRowLast: {
    flexDirection: 'row',
    borderBottomWidth: 0,
  },

  tableCell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    minHeight: 80,
  },

  tableCellLast: {
    flex: 1,
    padding: 8,
    borderRightWidth: 0,
    minHeight: 80,
  },

  tableHeader: {
    fontFamily: FONTS.serifBold,
    fontSize: FONT_SIZES.text,
    marginBottom: 4,
  },

  // Footer styling
  footer: {
    position: 'absolute',
    bottom: 30,
    left: MARGINS.left,
    right: MARGINS.right,
    fontSize: FONT_SIZES.footer,
    textAlign: 'center',
  },

  // Page number in footer
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: MARGINS.right,
    fontSize: FONT_SIZES.footer,
  },

  // Registration number (top right)
  registrationNumber: {
    position: 'absolute',
    top: MARGINS.top - 30,
    right: MARGINS.right,
    fontSize: FONT_SIZES.small,
    fontFamily: FONTS.serifBold,
  },

  // Signature section styling
  signature: {
    marginTop: 12,
    marginBottom: 12,
  },

  signatureLabel: {
    fontFamily: FONTS.serifBold,
    fontSize: FONT_SIZES.text,
    marginBottom: 36,
  },

  signatureValue: {
    fontFamily: FONTS.serifBold,
    fontSize: FONT_SIZES.text,
    textDecoration: 'underline',
  },

  // Administrative section
  administrative: {
    marginTop: 16,
  },

  // Map image container
  mapContainer: {
    marginTop: 12,
    alignItems: 'center',
  },

  mapImage: {
    width: 500,
    height: 328,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },

  // Attachment label
  attachmentLabel: {
    fontFamily: FONTS.serifBold,
    fontSize: FONT_SIZES.subtitle,
    marginBottom: 12,
  },

  // Witness info in table
  witnessName: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.text,
    marginBottom: 2,
  },

  witnessBoundary: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.small,
    color: '#333333',
    marginBottom: 2,
  },

  // Indented content
  indented: {
    paddingLeft: 30,
  },

  // Spacing utilities
  spacerSmall: {
    height: 6,
  },

  spacerMedium: {
    height: 12,
  },

  spacerLarge: {
    height: 24,
  },

  // Flex utilities
  flexRow: {
    flexDirection: 'row',
  },

  flexColumn: {
    flexDirection: 'column',
  },

  flex1: {
    flex: 1,
  },

  // Text alignment
  textLeft: {
    textAlign: 'left',
  },

  textCenter: {
    textAlign: 'center',
  },

  textRight: {
    textAlign: 'right',
  },

  textJustify: {
    textAlign: 'justify',
  },

  // Border utilities
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  borderTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  // Width utilities for tables
  width30: {
    width: '30%',
  },

  width50: {
    width: '50%',
  },

  width70: {
    width: '70%',
  },
});

/**
 * Get styles for a specific font weight
 */
export function getFontStyle(bold = false): { fontFamily: string } {
  return {
    fontFamily: bold ? FONTS.serifBold : FONTS.serif,
  };
}

/**
 * Format date to Indonesian format
 */
export function formatIndonesianDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format land area with m² suffix
 */
export function formatLuas(luas: number | undefined): string {
  if (luas === undefined || luas === null) return '';
  return `${luas.toLocaleString('id-ID')} m²`;
}
