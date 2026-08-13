/**
 * Continuation sheet for saksi that did not fit on the signature page.
 *
 * A pengajuan has no cap on witnesses — a plot can carry one per boundary side,
 * and boundaries are not limited to four — so the overflow gets its own sheets
 * rather than being refused at the form or silently truncated in the document.
 *
 * Identity and signature sit together here, unlike the signature page where they
 * are split into two columns: on a sheet of their own there is nothing to align
 * against, and keeping each witness in one block is what lets `pagination.ts`
 * predict how many fit.
 *
 * Numbering continues from the signature page — the fifth witness is "5." here,
 * not "1." — so the two sheets read as one list.
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import { DocumentFooter } from './DocumentFooter';
import { type WitnessSheet, totalCertificatePages } from './pagination';
import type { PageProps, SPPTGPDFData } from './types';

/** Label + colon + dotted line that either carries a value or stays blank. */
const IdentityRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <View style={styles.identityRow}>
    <Text style={styles.identityLabel}>{label}</Text>
    <Text style={styles.identityColon}>:</Text>
    <View style={styles.dottedLine}>
      <Text style={styles.identityValue}>{value?.trim() || ' '}</Text>
    </View>
  </View>
);

const WitnessBlock: React.FC<{
  number: number;
  witness: SPPTGPDFData['saksiList'][number];
}> = ({ number, witness }) => (
  <View style={{ marginBottom: 18 }} wrap={false}>
    <View style={styles.witnessIdentity}>
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

    <View style={styles.witnessSignature}>
      <View style={styles.row}>
        <Text style={styles.witnessSignatureNumber}>{number}.</Text>
        {witness?.sisi?.trim() ? (
          <Text style={styles.witnessSignatureSide}>Batas {witness.sisi.trim()}</Text>
        ) : (
          <View style={styles.dottedLine} />
        )}
      </View>
      <Text style={styles.witnessSignatureName}>
        ({witness?.nama?.trim() || '.....................'})
      </Text>
    </View>
  </View>
);

export const SPPTGWitnessPage: React.FC<PageProps & { sheet: WitnessSheet }> = ({
  data,
  sheet,
}) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.attachmentLabel}>Lanjutan Saksi Batas Lahan</Text>
    <Text style={[styles.text, { marginBottom: 8 }]}>
      Lanjutan dari daftar saksi pada halaman tanda tangan.
    </Text>

    {sheet.witnesses.map((witness, index) => (
      <WitnessBlock
        key={witness?.nama ? `${witness.nama}-${index}` : `saksi-${sheet.startIndex + index}`}
        number={sheet.startIndex + index + 1}
        witness={witness}
      />
    ))}

    <DocumentFooter page={sheet.page} totalPages={totalCertificatePages(data)} />
  </Page>
);

export default SPPTGWitnessPage;
