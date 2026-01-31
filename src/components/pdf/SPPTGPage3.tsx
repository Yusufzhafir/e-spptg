/**
 * SPPTG Page 3 Component
 * 
 * This component renders the third page of the SPPTG document containing:
 * - Map attachment header
 * - Land location map image
 * - Footer
 */

import React from 'react';
import { Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { PageProps } from './types';

export const SPPTGPage3: React.FC<PageProps> = ({ data, config }) => {
  const showMap = config?.includeMap !== false;

  return (
    <Page size="A4" style={styles.page}>
      {/* Map Attachment Header */}
      <Text style={styles.attachmentLabel}>Lampiran 1 Peta lahan</Text>

      {/* Map Image */}
      {showMap && data.mapImageUrl ? (
        <View style={styles.mapContainer}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={data.mapImageUrl} style={styles.mapImage} />
        </View>
      ) : (
        <View style={[styles.mapContainer, { borderWidth: 1, borderColor: '#ccc', padding: 20 }]}>
          <Text style={[styles.text, styles.textCenter]}>
            [Gambar Peta Lahan]
          </Text>
          <Text style={[styles.text, styles.textCenter, { fontSize: 9, marginTop: 10 }]}>
            Peta lokasi tanah akan ditampilkan di sini
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text>
          Surat Pernyataan Penguasaan Tanah Garapan - Halaman 3
        </Text>
      </View>
    </Page>
  );
};

export default SPPTGPage3;
