/**
 * SPPTG Page 3 Component - Witnesses and Signature Section
 *
 * Follows the official "surat pernyataan" closing layout:
 * - "Demikian surat pernyataan ini dibuat dengan disaksikan oleh:" followed by
 *   the identity of each witness (Nama, Umur, Pekerjaan, Alamat)
 * - Two columns: witness signature lines on the left, the declarant signature
 *   with meterai and the Kepala Desa/Lurah endorsement on the right
 *
 * Every field of a witness is captured by the wizard (nama, umur, pekerjaan and
 * alamat are all mandatory on the saksi form), so each block prints complete —
 * the dotted lines are only ever blank when the data really is missing.
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { styles, formatIndonesianDate } from './styles';
import { DocumentFooter } from './DocumentFooter';
import { buildWitnessSlots } from '@/lib/spptg-pdf-data';
import { isTerdataCertificate, PAGE_SIGNATURES, totalCertificatePages } from './pagination';
import { PageProps, SPPTGPDFData } from './types';

/**
 * Label + colon + dotted line that either carries a value or stays blank
 */
const IdentityRow: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <View style={styles.identityRow}>
    <Text style={styles.identityLabel}>{label}</Text>
    <Text style={styles.identityColon}>:</Text>
    <View style={styles.dottedLine}>
      <Text style={styles.identityValue}>{value?.trim() || ' '}</Text>
    </View>
  </View>
);

/**
 * Identity block of a single witness ("1. Nama … Umur … Pekerjaan … Alamat …")
 */
const WitnessIdentity: React.FC<{
  number: number;
  witness?: SPPTGPDFData['saksiList'][number];
}> = ({ number, witness }) => (
  <View style={styles.witnessIdentity} wrap={false}>
    <Text style={styles.statementNumber}>{number}.</Text>
    <View style={styles.flex1}>
      <IdentityRow label="Nama" value={witness?.nama} />
      <IdentityRow
        label="Umur"
        value={witness?.umur ? `${witness.umur} tahun` : undefined}
      />
      <IdentityRow label="Pekerjaan" value={witness?.pekerjaan} />
      <IdentityRow label="Alamat" value={witness?.alamat} />
    </View>
  </View>
);

/**
 * Witness signature line: the boundary side the witness represents, then room
 * to sign, then the name in brackets
 */
const WitnessSignature: React.FC<{
  number: number;
  nama?: string;
  sisi?: string;
}> = ({ number, nama, sisi }) => (
  <View style={styles.witnessSignature} wrap={false}>
    <View style={styles.row}>
      <Text style={styles.witnessSignatureNumber}>{number}.</Text>
      {sisi?.trim() ? (
        <Text style={styles.witnessSignatureSide}>Batas {sisi.trim()}</Text>
      ) : (
        <View style={styles.dottedLine} />
      )}
    </View>
    <Text style={styles.witnessSignatureName}>
      ({nama?.trim() || '.....................'})
    </Text>
  </View>
);

export const SPPTGPage3: React.FC<PageProps> = ({ data, config }) => {
  const formattedDate = formatIndonesianDate(data.tanggalPernyataan);
  // Desa and kecamatan often carry the same name (e.g. Sangatta Utara) - print
  // it once in that case instead of repeating it.
  const declarationLocation =
    [...new Set(
      [data.namaDesa, data.kecamatan]
        .map((value) => value?.trim())
        .filter(Boolean)
    )].join(', ') || '.....................';

  const showWitnesses = config?.includeWitnesses !== false;
  // No desa endorses a parcel that is still contested: the terdata variant drops
  // the Kepala Desa block and carries the disclosure notice below instead.
  const showAdministrative =
    config?.includeAdministrative !== false && !isTerdataCertificate(data);

  // One block per recorded saksi — one saksi prints one block, four print four.
  const witnessSlots = buildWitnessSlots(data.saksiList);

  return (
    <Page size="A4" style={styles.page}>
      {/* Witness identities */}
      {showWitnesses && (
        <>
          <Text style={styles.text}>
            Demikian surat pernyataan ini dibuat dengan disaksikan oleh:
          </Text>

          {witnessSlots.map((witness, index) => (
            <WitnessIdentity
              key={witness?.nama ? `${witness.nama}-${index}` : `saksi-${index}`}
              number={index + 1}
              witness={witness}
            />
          ))}

          <View style={styles.spacerMedium} />
        </>
      )}

      {/* Signature columns */}
      <View style={styles.signatureColumns}>
        {/* Left column - witness signatures */}
        <View style={styles.signatureColumnLeft}>
          {showWitnesses && (
            <>
              <Text style={styles.text}>Saksi-saksi :</Text>
              {witnessSlots.map((witness, index) => (
                <WitnessSignature
                  key={
                    witness?.nama
                      ? `ttd-${witness.nama}-${index}`
                      : `ttd-saksi-${index}`
                  }
                  number={index + 1}
                  nama={witness?.nama}
                  sisi={witness?.sisi}
                />
              ))}
            </>
          )}
        </View>

        {/* Right column - declarant and Kepala Desa/Lurah */}
        <View style={styles.signatureColumnRight}>
          <Text style={styles.signatureCentered}>
            {declarationLocation}, {formattedDate}
          </Text>

          <View style={styles.spacerSmall} />

          <Text style={styles.signatureCentered}>Yang membuat pernyataan,</Text>

          <View style={styles.meteraiBox}>
            <Text style={styles.meteraiText}>Meterai</Text>
            <Text style={styles.meteraiText}>Rp10.000</Text>
          </View>

          <Text style={[styles.signatureCentered, styles.signatureName]}>
            ({data.namaPemohon?.trim() || '..............................'})
          </Text>

          {showAdministrative && (
            <>
              <View style={styles.spacerLarge} />

              <Text style={styles.signatureCentered}>Mengetahui,</Text>
              <Text style={styles.signatureCentered}>(Kepala Desa/Lurah)</Text>

              <View style={styles.spacerLarge} />
              <View style={styles.spacerLarge} />

              <Text style={[styles.signatureCentered, styles.signatureName]}>
                ({data.namaKepalaDesa?.trim() || '..............................'})
              </Text>
            </>
          )}
        </View>
      </View>

      {/* The disclosure notice is its own page — see `pagination.ts`. */}

      <DocumentFooter page={PAGE_SIGNATURES} totalPages={totalCertificatePages(data)} />
    </Page>
  );
};

export default SPPTGPage3;
