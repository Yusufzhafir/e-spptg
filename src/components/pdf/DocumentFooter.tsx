/**
 * Shared footer for every SPPTG page.
 *
 * The numbers are passed in, not read from react-pdf's `pageNumber` /
 * `totalPages`. A `Text` with a `render` prop prints **nothing at all** in this
 * document — verified twice, both bare and inside a `fixed` View. The cause is
 * `Font.registerHyphenationCallback` in `fonts.ts`: with it registered, the
 * dynamically produced string never reaches the page. A throwaway document
 * without that callback renders the same footer fine, which is what made the
 * feature look available.
 *
 * That is why the page count has to be knowable up front — see `pagination.ts`.
 */

import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles } from './styles';

export const DocumentFooter: React.FC<{ page: number; totalPages: number }> = ({
  page,
  totalPages,
}) => (
  <View style={styles.footer} fixed>
    <Text>
      Surat Pernyataan Penguasaan Tanah Garapan - Halaman {page} dari {totalPages}
    </Text>
  </View>
);

export default DocumentFooter;
