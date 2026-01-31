/**
 * PDF Font Configuration for SPPTG Document
 * 
 * React-PDF comes with built-in support for standard PDF fonts.
 * For government documents in Indonesia, we use Times-Roman (serif)
 * which is the standard for official documents.
 * 
 * Available standard fonts in React-PDF:
 * - Courier
 * - Courier-Bold
 * - Courier-Oblique
 * - Courier-BoldOblique
 * - Helvetica
 * - Helvetica-Bold
 * - Helvetica-Oblique
 * - Helvetica-BoldOblique
 * - Times-Roman
 * - Times-Bold
 * - Times-Italic
 * - Times-BoldItalic
 * - Symbol
 * - ZapfDingbats
 */

// Fonts are standard PDF fonts and don't need explicit registration

/**
 * Font family constants
 */
export const FONT_FAMILIES = {
  TIMES_ROMAN: 'Times-Roman',
  TIMES_BOLD: 'Times-Bold',
  TIMES_ITALIC: 'Times-Italic',
  TIMES_BOLD_ITALIC: 'Times-BoldItalic',
  HELVETICA: 'Helvetica',
  HELVETICA_BOLD: 'Helvetica-Bold',
  COURIER: 'Courier',
  COURIER_BOLD: 'Courier-Bold',
} as const;

/**
 * Primary font family for SPPTG documents
 */
export const PRIMARY_FONT = FONT_FAMILIES.TIMES_ROMAN;
export const PRIMARY_FONT_BOLD = FONT_FAMILIES.TIMES_BOLD;

/**
 * Font weights
 */
export const FONT_WEIGHTS = {
  NORMAL: 400,
  BOLD: 700,
} as const;

/**
 * Register custom fonts if needed in the future
 * Currently we use standard PDF fonts which don't require registration
 */
export function registerFonts(): void {
  // Standard fonts are already available in React-PDF
  // No registration needed for Times-Roman, Helvetica, etc.
  
  // If you need custom fonts in the future, register them here:
  // Font.register({
  //   family: 'CustomFont',
  //   src: '/fonts/custom-font.ttf',
  // });
}

/**
 * Get font name based on style
 */
export function getFontName(options: {
  bold?: boolean;
  italic?: boolean;
  family?: 'times' | 'helvetica' | 'courier';
} = {}): string {
  const { bold = false, italic = false, family = 'times' } = options;
  
  const familyMap: Record<string, Record<string, string>> = {
    times: {
      normal: FONT_FAMILIES.TIMES_ROMAN,
      bold: FONT_FAMILIES.TIMES_BOLD,
      italic: FONT_FAMILIES.TIMES_ITALIC,
      boldItalic: FONT_FAMILIES.TIMES_BOLD_ITALIC,
    },
    helvetica: {
      normal: FONT_FAMILIES.HELVETICA,
      bold: FONT_FAMILIES.HELVETICA_BOLD,
      italic: FONT_FAMILIES.HELVETICA,
      boldItalic: FONT_FAMILIES.HELVETICA_BOLD,
    },
    courier: {
      normal: FONT_FAMILIES.COURIER,
      bold: FONT_FAMILIES.COURIER_BOLD,
      italic: FONT_FAMILIES.COURIER,
      boldItalic: FONT_FAMILIES.COURIER_BOLD,
    },
  };
  
  const selectedFamily = familyMap[family];
  
  if (bold && italic) {
    return selectedFamily.boldItalic;
  } else if (bold) {
    return selectedFamily.bold;
  } else if (italic) {
    return selectedFamily.italic;
  } else {
    return selectedFamily.normal;
  }
}
