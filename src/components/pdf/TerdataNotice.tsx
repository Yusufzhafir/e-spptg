/**
 * The disclosure notice printed on a SPPTG *terdata* certificate.
 *
 * A terdata certificate is issued over land the overlap check flagged, so the
 * document has to carry that on its face rather than in a system somewhere: a
 * yellow block naming every kawasan the parcel sits on, ticked from the overlap
 * results, and signed by the surveyor who established it.
 *
 * The Kepala Desa endorsement is dropped on this variant (see SPPTGPage3) —
 * this signature replaces it, because what is being attested is the survey
 * finding, not the desa's approval of the claim.
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import { DocumentFooter } from './DocumentFooter';
import { terdataNoticePage, totalCertificatePages } from './pagination';
import type { PageProps } from './types';
import { TERDATA_OVERLAP_STATUSES } from '@/lib/spptg-terdata';

const ChecklistRow: React.FC<{ label: string; checked: boolean }> = ({ label, checked }) => (
  <View style={styles.noticeChecklistRow} wrap={false}>
    {/* Filled square rather than a glyph — see `noticeCheckboxFill`. */}
    <View style={styles.noticeCheckbox}>
      {checked ? <View style={styles.noticeCheckboxFill} /> : null}
    </View>
    <Text style={styles.noticeChecklistLabel}>{label}</Text>
  </View>
);

export const TerdataNoticeBlock: React.FC<{
  overlapStatuses?: string[];
  namaJuruUkur?: string;
  jabatanJuruUkur?: string;
}> = ({ overlapStatuses, namaJuruUkur, jabatanJuruUkur }) => {
  const checked = new Set(overlapStatuses ?? []);

  // Split down the middle so the taller column is the left one — a 7/6 split
  // reads better than 6/7 when the box is bottom-aligned on the page.
  const half = Math.ceil(TERDATA_OVERLAP_STATUSES.length / 2);
  const columns = [
    TERDATA_OVERLAP_STATUSES.slice(0, half),
    TERDATA_OVERLAP_STATUSES.slice(half),
  ];

  // No heading inside the box: the page it sits on already carries one.
  return (
    <View style={styles.noticeBox} wrap={false}>
      <Text style={styles.noticeText}>
        Berdasarkan hasil verifikasi fisik bidang tanah yang dilakukan oleh tim peneliti
        terhadap areal yang diajukan, seluruh bidang tanah yang diajukan berada pada:
      </Text>

      <View style={styles.noticeChecklist}>
        {columns.map((column, columnIndex) => (
          <View key={`kolom-${columnIndex}`} style={styles.noticeChecklistColumn}>
            {column.map((status, index) => (
              <ChecklistRow
                key={status}
                label={`${columnIndex * half + index + 1}. ${status}`}
                checked={checked.has(status)}
              />
            ))}
          </View>
        ))}
      </View>

      {/* The consequence of the ticks above, stated on the certificate itself:
          a terdata berkas cannot be registered and no desa signs it off. It sits
          immediately before the surveyor's signature so what is being attested
          is unmistakable. */}
      <Text style={[styles.noticeText, { marginTop: 8 }]}>
        Sehingga SPPTG yang diajukan tidak bisa dilakukan REGISTER / PENDAFTARAN dan
        tidak bisa ditandatangani dan disahkan kepala desa.
      </Text>

      <View style={styles.noticeSignature}>
        <View style={styles.noticeSignatureBlock}>
          <Text style={styles.signatureCentered}>Tim Peneliti (Juru Ukur),</Text>
          <View style={styles.spacerLarge} />
          <View style={styles.spacerLarge} />
          <Text style={[styles.signatureCentered, styles.signatureName]}>
            ({namaJuruUkur?.trim() || '..............................'})
          </Text>
          {jabatanJuruUkur?.trim() ? (
            <Text style={styles.signatureCentered}>{jabatanJuruUkur.trim()}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

/**
 * The notice as its own sheet. Its own page rather than a trailing block on the
 * signature page: the block's height depends on how many saksi precede it, and a
 * layout that sometimes spills onto an extra sheet cannot be numbered (see
 * `pagination.ts`).
 */
export const SPPTGPageTerdataNotice: React.FC<PageProps> = ({ data }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.attachmentLabel}>Catatan Hasil Verifikasi Fisik Bidang Tanah</Text>

    <TerdataNoticeBlock
      overlapStatuses={data.overlapStatuses}
      namaJuruUkur={data.namaJuruUkur}
      jabatanJuruUkur={data.jabatanJuruUkur}
    />

    <DocumentFooter page={terdataNoticePage(data)} totalPages={totalCertificatePages(data)} />
  </Page>
);

export default TerdataNoticeBlock;
