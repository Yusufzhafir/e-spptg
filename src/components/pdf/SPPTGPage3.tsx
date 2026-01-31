/**
 * SPPTG Page 3 Component - Administrative Section
 * 
 * This component renders the third page of the SPPTG document containing:
 * - Administrative section with Nomor Registrasi and Tanggal
 * - Kepala Desa signature block
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { styles, formatIndonesianDate } from './styles';
import { PageProps } from './types';

export const SPPTGPage3: React.FC<PageProps> = ({ data }) => {
  const formattedDate = formatIndonesianDate(data.tanggalPernyataan);

  return (
    <Page size="A4" style={styles.page}>
      {/* Administrative Section */}
      <View style={styles.administrative}>
        <Text style={styles.subtitle}>Mengetahui</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Nomor Registrasi</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={[styles.value, { fontFamily: 'Times-Bold' }]}>
            {data.nomorSPPTG}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tanggal</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{formattedDate}</Text>
        </View>

        <View style={styles.spacerSmall} />

        <View style={styles.signature}>
          <Text style={styles.signatureLabel}>
            Kepala Desa {data.namaDesa}
          </Text>
          <View style={styles.spacerLarge} />
          <View style={styles.spacerLarge} />
          <Text style={styles.signatureValue}>
            {data.namaKepalaDesa || '(_________________________)'}
          </Text>
        </View>
      </View>

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
