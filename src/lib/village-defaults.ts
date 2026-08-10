import type { SubmissionDraft } from '@/types';

/**
 * The village master-data fields a draft copies for itself. Narrower than the
 * full village row on purpose — this is everything the wizard reads.
 */
export interface VillageDefaultsSource {
  namaKepalaDesa?: string | null;
  juruUkurNama?: string | null;
  juruUkurJabatan?: string | null;
  juruUkurInstansi?: string | null;
  juruUkurNomorHP?: string | null;
}

/** Just enough of a draft to decide what is still missing. */
type DraftDefaults = Pick<SubmissionDraft, 'juruUkur' | 'namaKepalaDesa'>;

/**
 * What a draft is still missing from its desa's settings.
 *
 * Juru ukur and kepala desa are copied into the payload at the moment the desa
 * is picked (`Step1DocumentUpload.handleVillageChange`), and nothing re-reads
 * them afterwards. A desa whose settings were filled in *after* that pick
 * therefore leaves the draft holding nothing, and Tahap Lapangan renders an
 * empty Tim Peneliti with no way to notice why.
 *
 * Filling the gap is safe; refreshing it is not. `draft.juruUkur` is printed on
 * the SPPTG as the team that surveyed this land — replacing it with whoever
 * currently holds the post would rewrite history on every reprint. So an
 * existing value is never touched, and a partially-filled desa contributes only
 * the fields it actually has.
 *
 * Returns an empty object when there is nothing to add, so callers can skip the
 * write (and the re-render) entirely.
 */
export function buildVillageDefaultsPatch(
  draft: DraftDefaults,
  village: VillageDefaultsSource | undefined
): Partial<SubmissionDraft> {
  if (!village) return {};

  const patch: Partial<SubmissionDraft> = {};

  // All three are mandatory on ResearchTeamMember, and a half-built juru ukur
  // would fail step2LapanganSchema on save — so it is all of them or none.
  if (
    !draft.juruUkur &&
    village.juruUkurNama &&
    village.juruUkurJabatan &&
    village.juruUkurNomorHP
  ) {
    patch.juruUkur = {
      nama: village.juruUkurNama,
      jabatan: village.juruUkurJabatan,
      instansi: village.juruUkurInstansi || undefined,
      nomorHP: village.juruUkurNomorHP,
    };
  }

  if (!draft.namaKepalaDesa && village.namaKepalaDesa) {
    patch.namaKepalaDesa = village.namaKepalaDesa;
  }

  return patch;
}
