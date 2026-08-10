/**
 * SPPTG Page 2 Component
 *
 * This component renders the statement list (angka 2 s.d. 14) of the SPPTG
 * document. The wording follows the official "Surat Pernyataan Penguasaan
 * Fisik Bidang Tanah" points, with two SPPTG-specific clauses kept in place:
 * the boundary marker/witness agreement (angka 7) and the land-use suitability
 * undertaking (angka 14).
 *
 * Statement 1 (data fisik bidang tanah) is on page 1 (SPPTGPage1); the
 * signature, witnesses and administrative blocks are on page 3 (SPPTGPage3).
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import { DocumentFooter } from './DocumentFooter';
import { PAGE_STATEMENTS_CONT, totalCertificatePages } from './pagination';
import { PageProps } from './types';

/** Placeholder for data that is filled in by hand on the printed form */
const BLANK = '……………………………';

/**
 * Statement component for numbered statements
 */
const Statement: React.FC<{
  number: string;
  children: React.ReactNode;
}> = ({ number, children }) => (
  <View style={styles.row} wrap={false}>
    <Text style={styles.statementNumber}>{number}</Text>
    <View style={styles.statementContent}>{children}</View>
  </View>
);

/**
 * Sub-statement component for lettered items (a, b)
 */
const SubStatement: React.FC<{
  letter: string;
  children: React.ReactNode;
}> = ({ letter, children }) => (
  <View style={styles.row}>
    <Text style={styles.subStatementLetter}>{letter}.</Text>
    <View style={styles.statementContent}>{children}</View>
  </View>
);

export const SPPTGPage2: React.FC<PageProps> = ({ data }) => {
  // Recorded values are printed as-is; anything missing keeps the fill-in form
  // of the official template so it can be completed by hand.
  const statusTanah = data.statusTanah?.trim();
  const asalPerolehan = data.asalPerolehan?.trim();

  return (
    <Page size="A4" style={styles.page}>
      {/* Statement 2 - Ownership and land status */}
      <Statement number="2.">
        <Text style={styles.text}>
          Bidang tanah tersebut adalah benar milik saya bukan milik orang lain
          dan statusnya adalah{' '}
          {statusTanah ? (
            <Text style={{ fontFamily: 'Times-Bold' }}>{statusTanah}</Text>
          ) : (
            <Text>Tanah Negara/Tanah Ulayat/{BLANK} *)</Text>
          )}
          ;
        </Text>
      </Statement>

      {/* Statement 3 - Continuous physical possession */}
      <Statement number="3.">
        <Text style={styles.text}>
          Bidang tanah tersebut saya kuasai secara fisik sejak tahun{' '}
          <Text style={{ fontFamily: 'Times-Bold' }}>
            {data.tahunAwalGarap || '…………'}
          </Text>{' '}
          yang sampai saat ini saya kuasai, saya gunakan dan saya pelihara
          secara terus menerus;
        </Text>
      </Statement>

      {/* Statement 4 - Origin of acquisition */}
      <Statement number="4.">
        <Text style={styles.text}>
          Bidang tanah tersebut saya peroleh dari{' '}
          {asalPerolehan ? (
            <Text style={{ fontFamily: 'Times-Bold' }}>{asalPerolehan}</Text>
          ) : (
            <Text>{BLANK}</Text>
          )}{' '}
          sejak tahun{' '}
          <Text style={{ fontFamily: 'Times-Bold' }}>
            {data.tahunPerolehan || '…………'}
          </Text>
          ;
        </Text>
      </Statement>

      {/* Statement 5 - Good faith and open possession */}
      <Statement number="5.">
        <Text style={styles.text}>
          Penguasaan bidang tanah tersebut dengan iktikad baik dan secara
          terbuka oleh saya sebagai yang berhak atas bidang tanah tersebut;
        </Text>
      </Statement>

      {/* Statement 6 - Truthfulness of data and applicant liability */}
      <Statement number="6.">
        <Text style={styles.text}>
          Perolehan tanah dibuat sesuai data yang sebenarnya dan apabila
          ternyata di kemudian hari terjadi permasalahan menjadi tanggung jawab
          pemohon sepenuhnya dan tidak akan melibatkan Kementerian;
        </Text>
      </Statement>

      {/* Statement 7 - Boundary markers and neighbour agreement (SPPTG-specific) */}
      <Statement number="7.">
        <Text style={styles.text}>
          Bidang tanah tersebut telah saya pasangi patok/pal batas pada bagian
          batas sudut-sudutnya dan telah mendapat persetujuan dari semua pihak
          yang berbatasan, di mana mereka membubuhkan tanda tangan pada surat
          pernyataan ini;
        </Text>
      </Statement>

      {/* Statement 8 - No dispute */}
      <Statement number="8.">
        <Text style={styles.text}>
          Bidang tanah tersebut baik sebagian atau keseluruhan tidak terdapat
          konflik/sengketa/perkara dan keberatan dari pihak lain atas tanah yang
          dimiliki atau tidak dalam keadaan sengketa, baik dengan orang, badan
          hukum, pemerintah dan/atau pihak lainnya;
        </Text>
      </Statement>

      {/* Statement 9 - Not pledged as collateral */}
      <Statement number="9.">
        <Text style={styles.text}>
          Bidang tanah tersebut tidak dijadikan/menjadi jaminan sesuatu utang/
          tidak terdapat keberatan dari pihak Kreditur (apabila dijadikan/
          menjadi jaminan sesuatu utang) *);
        </Text>
      </Statement>

      {/* Statement 10 - Not a state/regional/SOE asset */}
      <Statement number="10.">
        <Text style={styles.text}>Bidang tanah tersebut bukan aset *):</Text>
        <SubStatement letter="a">
          <Text style={styles.text}>
            pemerintah/pemerintah daerah/Badan Usaha Milik Negara/Badan Usaha
            Milik Daerah; atau
          </Text>
        </SubStatement>
        <SubStatement letter="b">
          <Text style={styles.text}>
            pemerintah/pemerintah daerah/Badan Usaha Milik Negara/Badan Usaha
            Milik Daerah lain, untuk permohonan Hak Pengelolaan atau Hak Pakai
            selama dipergunakan yang dimohon oleh instansi pemerintah;
          </Text>
        </SubStatement>
      </Statement>

      {/* Statement 11 - Outside forest areas */}
      <Statement number="11.">
        <Text style={styles.text}>
          Bidang tanah tersebut berada di luar kawasan hutan, di luar areal yang
          dihentikan perizinannya pada hutan alam primer dan lahan gambut;
        </Text>
      </Statement>

      {/* Statement 12 - Public access undertaking */}
      <Statement number="12.">
        <Text style={styles.text}>
          Bersedia untuk tidak mengurung atau menutup pekarangan atau bidang
          tanah lain dari lalu lintas umum, akses publik dan/atau jalan air;
        </Text>
      </Statement>

      {/* Statement 13 - Release for public interest */}
      <Statement number="13.">
        <Text style={styles.text}>
          Bersedia melepaskan tanah untuk kepentingan umum baik sebagian atau
          seluruhnya;
        </Text>
      </Statement>

      {/* Statement 14 - Land-use suitability undertaking (SPPTG-specific) */}
      <Statement number="14.">
        <Text style={styles.text}>
          Apabila di kemudian hari diketahui bahwa bidang tanah yang saya kuasai
          sebagaimana diuraikan pada angka 1 (satu) berada dalam kawasan yang
          peruntukannya tidak sesuai dengan pengelolaan/penguasaan saya, maka
          saya bersedia mengajukan permohonan, mengurus dan menyesuaikan
          pengelolaan hak atas lahan saya sesuai dengan ketentuan peraturan yang
          berlaku.
        </Text>
      </Statement>

      <View style={styles.spacerMedium} />

      {/* Closing Statement */}
      <Text style={styles.text}>
        Surat pernyataan ini saya buat dengan sebenar-benarnya dengan penuh
        tanggung jawab baik secara perdata maupun pidana, apabila di kemudian
        hari terdapat unsur-unsur yang tidak dibenarkan dalam pernyataan ini
        maka segala akibat yang timbul menjadi tanggung jawab saya dan bersedia
        dituntut sesuai dengan ketentuan peraturan perundang-undangan serta
        tidak akan melibatkan pihak lain dan saya bersedia sertipikat yang saya
        terima dibatalkan oleh pejabat yang berwenang.
      </Text>

      <DocumentFooter page={PAGE_STATEMENTS_CONT} totalPages={totalCertificatePages(data)} />
    </Page>
  );
};

export default SPPTGPage2;
