/**
 * The result of "Cek Tumpang Tindih" on a kawasan boundary that has not been
 * saved yet.
 *
 * Lives in `lib/` rather than beside the PostGIS query because both sides need
 * it: the server produces these rows, the form renders them and decides whether
 * the save may go through. One shape, so a column added to the query cannot
 * quietly stop being displayed.
 */

/** One thing a candidate boundary runs into. */
export interface KawasanGeometryConflict {
  jenis: 'kawasan' | 'pengajuan';
  id: number;
  /** Nama kawasan, or the pemilik of the pengajuan. */
  nama: string;
  /** Jenis kawasan, or the desa the pengajuan sits in. */
  keterangan: string;
  /** Only meaningful for `jenis: 'pengajuan'`; empty for a kawasan. */
  status: string;
  /** Only meaningful for `jenis: 'kawasan'`. */
  aktifDiValidasi: boolean;
  luasOverlap: number;
  /** Share of the **candidate** boundary covered, so the figures compare to each other. */
  percentageOverlap: number;
}

export interface KawasanConflictSummary {
  kawasan: KawasanGeometryConflict[];
  pengajuan: KawasanGeometryConflict[];
  total: number;
  /** Indonesian phrase for the counts, e.g. "2 kawasan Non-SPPTG dan 1 pengajuan SPPTG". */
  ringkasan: string;
}

/**
 * Split a result into its two halves and phrase the count.
 *
 * The two kinds are never merged into one number in the UI: a clash with
 * another kawasan is a data-quality problem for the office to reconcile, while
 * a clash with a pengajuan is somebody's land claim about to be declared
 * restricted. An officer deciding whether to tick "tetap lanjutkan" is deciding
 * about the second one, so it has to be countable on its own.
 */
export function summarizeKawasanConflicts(
  conflicts: readonly KawasanGeometryConflict[]
): KawasanConflictSummary {
  const kawasan = conflicts.filter((row) => row.jenis === 'kawasan');
  const pengajuan = conflicts.filter((row) => row.jenis === 'pengajuan');

  const parts: string[] = [];
  if (kawasan.length > 0) parts.push(`${kawasan.length} kawasan Non-SPPTG`);
  if (pengajuan.length > 0) parts.push(`${pengajuan.length} pengajuan SPPTG`);

  return {
    kawasan,
    pengajuan,
    total: conflicts.length,
    ringkasan: parts.join(' dan '),
  };
}
