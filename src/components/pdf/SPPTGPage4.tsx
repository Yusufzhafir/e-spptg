/**
 * SPPTG Page 4 Component - Map Attachment
 * 
 * This component renders the fourth page of the SPPTG document containing:
 * - Map attachment header
 * - Land location map image
 */

import React from 'react';
import { Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { PageProps } from './types';

export const SPPTGPage4: React.FC<PageProps> = ({ data, config }) => {
  const showMap = config?.includeMap !== false;

  return (
    <Page size="A4" style={styles.page}>
      {/* Map Attachment Header */}
      <Text style={styles.attachmentLabel}>Lampiran 1 - Peta Lokasi Tanah</Text>

      {/* Map Image */}
      {showMap && data.mapImageUrl ? (
        <View style={styles.mapContainer}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={data.mapImageUrl} style={styles.mapImage} />
        </View>
      ) : (
        <View style={[styles.mapContainer, { borderWidth: 1, borderColor: '#ccc', padding: 40, minHeight: 400 }]}>
          <Text style={[styles.text, styles.textCenter, { marginTop: 100 }]}>
            [Peta Lokasi Tanah]
          </Text>
          <Text style={[styles.text, styles.textCenter, { fontSize: 9, marginTop: 20 }]}>
            Gambar peta lokasi tanah akan ditampilkan di sini.
          </Text>
          <Text style={[styles.text, styles.textCenter, { fontSize: 8, marginTop: 10, color: '#666' }]}>
            Pastikan koordinat lokasi telah diinput dengan benar pada tahap validasi lapangan.
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

export default SPPTGPage4;
