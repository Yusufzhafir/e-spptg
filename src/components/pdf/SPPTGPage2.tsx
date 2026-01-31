/**
 * SPPTG Page 2 Component
 * 
 * This component renders the second page of the SPPTG document containing:
 * - Statements 4 and 5
 * - Legal disclaimer/closing statement
 * - Location and date declaration
 * - Declarant signature section
 * - Witnesses table (2x2 grid with 4 witnesses)
 * - Administrative section (Kepala Desa signature)
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
  <View style={isLast ? styles.tableCellLast : styles.tableCell}>
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

  // Get witnesses (up to 4)
  const witnesses = data.saksiList.slice(0, 4);
  const witness1 = witnesses[0];
  const witness2 = witnesses[1];
  const witness3 = witnesses[2];
  const witness4 = witnesses[3];

  const showWitnesses = config?.includeWitnesses !== false && witnesses.length > 0;
  const showAdministrative = config?.includeAdministrative !== false;

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

      {/* Witnesses Section */}
      {showWitnesses && (
        <>
          <Text style={styles.subtitle}>Saksi-saksi batas</Text>

          {/* 2x2 Witnesses Table */}
          <View style={styles.table}>
            {/* First Row */}
            <View style={styles.tableRow}>
              <WitnessCell witness={witness1} />
              <WitnessCell witness={witness2} isLast />
            </View>

            {/* Second Row */}
            <View style={styles.tableRowLast}>
              <WitnessCell witness={witness3} />
              <WitnessCell witness={witness4} isLast />
            </View>
          </View>
        </>
      )}

      <View style={styles.spacerMedium} />

      {/* Administrative Section */}
      {showAdministrative && (
        <View style={styles.administrative}>
          <Text style={styles.subtitle}>Mengetahui</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Nomor Registrasi:</Text>
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
