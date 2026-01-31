/**
 * SPPTG Page 2 Component
 * 
 * This component renders the second page of the SPPTG document containing:
 * - Statements 4 and 5
 * - Legal disclaimer/closing statement
 * - Location and date declaration
 * - Declarant signature section
 * - Witnesses table (up to 8 witnesses in 2x4 grid)
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { styles, formatIndonesianDate } from './styles';
import { PageProps } from './types';

/**
 * Statement component for numbered statements
 */
const Statement: React.FC<{
  number: string;
  children: React.ReactNode;
}> = ({ number, children }) => (
  <View style={styles.row}>
    <Text style={styles.statementNumber}>{number}</Text>
    <View style={styles.statementContent}>{children}</View>
  </View>
);

/**
 * Witness cell component for the table
 */
const WitnessCell: React.FC<{
  witness?: {
    nama: string;
    sisi: string;
    penggunaanLahanBatas?: string;
  };
  isLast?: boolean;
}> = ({ witness, isLast = false }) => (
  <View style={[isLast ? styles.tableCellLast : styles.tableCell, { minHeight: 60 }]}>
    {witness ? (
      <>
        <Text style={styles.witnessName}>{witness.nama}</Text>
        <Text style={styles.witnessBoundary}>{witness.sisi}</Text>
        <Text style={styles.witnessBoundary}>
          {witness.penggunaanLahanBatas || '-'}
        </Text>
      </>
    ) : (
      <Text style={styles.text}>-</Text>
    )}
  </View>
);

export const SPPTGPage2: React.FC<PageProps> = ({ data, config }) => {
  // Format date
  const formattedDate = formatIndonesianDate(data.tanggalPernyataan);

  // Get witnesses (up to 8)
  const witnesses = data.saksiList.slice(0, 8);
  const showWitnesses = config?.includeWitnesses !== false;

  // Split witnesses into rows of 4
  const row1 = witnesses.slice(0, 4);
  const row2 = witnesses.slice(4, 8);
  const hasRow2 = row2.length > 0;

  return (
    <Page size="A4" style={styles.page}>
      {/* Statement 4 */}
      <Statement number="4.">
        <Text style={styles.text}>
          Lahan tersebut baik sebagian atau keseluruhan tidak ada sengketa /
          gugatan / tuntutan baik dengan orang, badan hukum, pemerintah,
          dan/atau pihak lainnya.
        </Text>
      </Statement>

      {/* Statement 5 */}
      <Statement number="5.">
        <Text style={styles.text}>
          Berkenaan di kemudian hari diketahui bahwa lahan yang saya kuasai
          sebagaimana diuraikan pada angka 1 (satu) berada dalam kawasan yang
          peruntukannya tidak sesuai dengan pengelolaan / penguasaan saya maka
          saya bersedia mengajukan permohonan, mengurus dan menyesuaikan
          pengelolaan hak atas lahan saya sesuai dengan ketentuan peraturan
          yang berlaku.
        </Text>
      </Statement>

      <View style={styles.spacerMedium} />

      {/* Closing Statement */}
      <Text style={styles.text}>
        Demikian Surat Pernyataan ini saya buat dalam keadaan sadar dan tanpa
        paksaan dari pihak manapun. Apabila di kemudian hari terbukti
        pernyataan saya ini tidak benar maka saya bersedia dituntut sesuai
        ketentuan perundang-undangan yang berlaku.
      </Text>

      <View style={styles.spacerMedium} />

      {/* Location and Date */}
      <Text style={styles.text}>
        Dibuat di{' '}
        <Text style={{ fontFamily: 'Times-Bold' }}>{data.namaDesa}</Text> pada
        tanggal{' '}
        <Text style={{ fontFamily: 'Times-Bold' }}>{formattedDate}</Text>
      </Text>

      <View style={styles.spacerMedium} />

      {/* Declarant Signature */}
      <View style={styles.signature}>
        <Text style={styles.signatureLabel}>Yang membuat pernyataan</Text>
        <View style={styles.spacerLarge} />
        <View style={styles.spacerLarge} />
        <Text style={styles.signatureValue}>{data.namaPemohon}</Text>
      </View>

      <View style={styles.spacerMedium} />

      {/* Witnesses Section - Always show if enabled, even if empty */}
      {showWitnesses && (
        <>
          <Text style={styles.subtitle}>Saksi-saksi batas</Text>

          {/* Witnesses Table - 2 rows x 4 columns */}
          <View style={styles.table}>
            {/* First Row - Always show 4 cells */}
            <View style={hasRow2 ? styles.tableRow : styles.tableRowLast}>
              <WitnessCell witness={row1[0]} />
              <WitnessCell witness={row1[1]} />
              <WitnessCell witness={row1[2]} />
              <WitnessCell witness={row1[3]} isLast />
            </View>

            {/* Second Row - Only if there are more than 4 witnesses */}
            {hasRow2 && (
              <View style={styles.tableRowLast}>
                <WitnessCell witness={row2[0]} />
                <WitnessCell witness={row2[1]} />
                <WitnessCell witness={row2[2]} />
                <WitnessCell witness={row2[3]} isLast />
              </View>
            )}
          </View>
        </>
      )}

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text>
          Surat Pernyataan Penguasaan Tanah Garapan - Halaman 2
        </Text>
      </View>
    </Page>
  );
};

export default SPPTGPage2;
