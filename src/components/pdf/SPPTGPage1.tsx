/**
 * SPPTG Page 1 Component
 * 
 * This component renders the first page of the SPPTG document containing:
 * - Document title and registration number
 * - Personal information section
 * - Statements 1, 2, and 3
 * - Land location details (1.a)
 * - Land measurements (1.b)
 * - Land use (1.c)
 * - Map reference (1.d)
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { styles, formatIndonesianDate, formatLuas } from './styles';
import { PageProps } from './types';

/**
 * Reusable field row component for label-value pairs
 */
const FieldRow: React.FC<{
  label: string;
  value?: string;
}> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.colon}>:</Text>
    <Text style={styles.value}>{value || '-'}</Text>
  </View>
);

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
 * Sub-statement component for lettered items (a, b, c, d)
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

export const SPPTGPage1: React.FC<PageProps> = ({ data }) => {
  // Format birth date
  const formattedBirthDate = data.tanggalLahir
    ? formatIndonesianDate(data.tanggalLahir)
    : '';
  const tempatTanggalLahir = [data.tempatLahir, formattedBirthDate]
    .filter(Boolean)
    .join(', ');

  return (
    <Page size="A4" style={styles.page}>
      {/* Registration Number - Top Right */}
      <View style={styles.registrationNumber}>
        <Text>{data.nomorSPPTG}</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>
        SURAT PERNYATAAN{'\n'}PENGUASAAN TANAH GARAPAN
      </Text>

      {/* Opening Statement */}
      <Text style={[styles.text, { marginBottom: 12 }]}>
        Saya yang bertanda tangan di bawah ini:
      </Text>

      {/* Personal Information Section */}
      <View style={styles.section}>
        <FieldRow label="Nama" value={data.namaPemohon} />
        <FieldRow label="NIK" value={data.nik} />
        <FieldRow label="Tempat/Tanggal Lahir" value={tempatTanggalLahir} />
        <FieldRow label="Pekerjaan" value={data.pekerjaan} />
        <FieldRow label="Alamat" value={data.alamatKTP} />
      </View>

      {/* Declaration */}
      <Text style={[styles.text, { marginTop: 12, marginBottom: 12 }]}>
        Dengan ini menyatakan hal-hal sebagai berikut:
      </Text>

      {/* Statement 1 */}
      <Statement number="1.">
        <Text style={styles.text}>
          Bahwa saya ada menguasai sebidang tanah seluas{' '}
          <Text style={{ fontFamily: 'Times-Bold' }}>
            {formatLuas(data.luasManual)}
          </Text>{' '}
          ({data.luasTerbilang}), dengan data fisik sebagai berikut:
        </Text>
      </Statement>

      {/* Statement 1.a - Land Location */}
      <SubStatement letter="a">
        <Text style={styles.text}>Letak tanah berada di lokasi berikut:</Text>
        <View style={styles.indented}>
          <FieldRow label="Jalan" value={data.namaJalan} />
          <FieldRow label="Gang" value={data.namaGang} />
          <FieldRow label="Nomor persil" value={data.nomorPersil} />
          <FieldRow label="RT / RW" value={data.rtrw} />
          <FieldRow label="Dusun" value={data.dusun} />
          <FieldRow label="Kelurahan/Desa" value={data.namaDesa} />
          <FieldRow label="Kecamatan" value={data.kecamatan} />
          <FieldRow label="Kabupaten" value={data.kabupaten} />
        </View>
      </SubStatement>

      {/* Statement 1.b - Land Measurements */}
      <SubStatement letter="b">
        <Text style={styles.text}>
          Ukuran tanah dengan spesifikasi berikut:
        </Text>
        <View style={styles.indented}>
          <FieldRow
            label="Luas pengukuran"
            value={`${formatLuas(data.luasManual)}`}
          />
          <FieldRow
            label="Luas perhitungan peta"
            value={`${formatLuas(data.luasLahan)}`}
          />
          {/* Display all 8 boundary positions */}
          {data.batasUtara && (
            <FieldRow
              label={data.batasUtara}
              value={data.penggunaanBatasUtara}
            />
          )}
          {data.batasTimurLaut && (
            <FieldRow
              label={data.batasTimurLaut}
              value={data.penggunaanBatasTimurLaut}
            />
          )}
          {data.batasTimur && (
            <FieldRow
              label={data.batasTimur}
              value={data.penggunaanBatasTimur}
            />
          )}
          {data.batasTenggara && (
            <FieldRow
              label={data.batasTenggara}
              value={data.penggunaanBatasTenggara}
            />
          )}
          {data.batasSelatan && (
            <FieldRow
              label={data.batasSelatan}
              value={data.penggunaanBatasSelatan}
            />
          )}
          {data.batasBaratDaya && (
            <FieldRow
              label={data.batasBaratDaya}
              value={data.penggunaanBatasBaratDaya}
            />
          )}
          {data.batasBarat && (
            <FieldRow
              label={data.batasBarat}
              value={data.penggunaanBatasBarat}
            />
          )}
          {data.batasBaratLaut && (
            <FieldRow
              label={data.batasBaratLaut}
              value={data.penggunaanBatasBaratLaut}
            />
          )}
        </View>
      </SubStatement>

      {/* Statement 1.c - Land Use */}
      <SubStatement letter="c">
        <View style={styles.row}>
          <Text style={styles.label}>Penggunaan lahan</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{data.penggunaanLahan || '-'}</Text>
        </View>
      </SubStatement>

      {/* Statement 1.d - Map Reference */}
      <SubStatement letter="d">
        <View style={styles.row}>
          <Text style={styles.label}>Peta lokasi tanah</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>terlampir</Text>
        </View>
      </SubStatement>

      <View style={styles.spacerSmall} />

      {/* Statement 2 */}
      <Statement number="2.">
        <Text style={styles.text}>
          Lahan tersebut telah saya kuasai, saya gunakan dan saya pelihara secara
          terus menerus sejak{' '}
          <Text style={{ fontFamily: 'Times-Bold' }}>
            {data.tahunAwalGarap || '-'}
          </Text>{' '}
          sampai dengan sekarang.
        </Text>
      </Statement>

      {/* Statement 3 */}
      <Statement number="3.">
        <Text style={styles.text}>
          Lahan tersebut telah saya pasangi patok/pal batas pada bagian batas
          sudut-sudut dan telah mendapat persetujuan dari semua pihak yang
          berbatasan, di mana mereka membubuhkan tanda tangan pada surat
          pernyataan ini.
        </Text>
      </Statement>

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text>
          Surat Pernyataan Penguasaan Tanah Garapan - Halaman 1
        </Text>
      </View>
    </Page>
  );
};

export default SPPTGPage1;
