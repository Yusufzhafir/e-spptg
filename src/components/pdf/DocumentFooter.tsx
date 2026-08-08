/**
 * Shared footer for every SPPTG page.
 *
 * The page number is passed in rather than rendered from `pageNumber`:
 * react-pdf (4.3.2) silently drops dynamically rendered text (`Text` with a
 * `render` prop) inside these pages, so a dynamic footer prints nothing at all.
 * Keep the numbers in sync with the page order in SPPTGDocument.
 */

import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles } from './styles';

export const DocumentFooter: React.FC<{ page: number; totalPages?: number }> = ({
  page,
  totalPages = 4,
}) => (
  <View style={styles.footer} fixed>
    <Text>
      Surat Pernyataan Penguasaan Tanah Garapan - Halaman {page} dari{' '}
      {totalPages}
    </Text>
  </View>
);

export default DocumentFooter;
