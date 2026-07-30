/**
 * How far a Viewer may look into a berkas that has moved on without them.
 *
 * A Viewer only ever *edits* Step 1, but they are the pengaju and want to track
 * where their berkas is. A step opens for reading once the officers have safely
 * left it behind:
 *
 *   - Lapangan (2) opens when the berkas reaches Hasil (3).
 *   - Hasil (3) opens when it reaches penerbitan (4) as an approved pengajuan.
 *   - Terbitkan SPPTG (4) never opens — the certificate is issued by the office,
 *     not tracked by the applicant.
 *
 * `status` is the Step 3 decision carried on the draft payload. Step 3 stays
 * closed unless it is 'SPPTG terdaftar': a berkas that was rejected or sent back
 * never legitimately reaches Step 4, so anything else means the pointer is
 * stale, and the Viewer should not read a decision through that gap.
 */
export function viewerMaxVisibleStep(
  progressStep: number,
  status: string | undefined
): 1 | 2 | 3 {
  if (progressStep >= 4 && status === 'SPPTG terdaftar') return 3;
  if (progressStep >= 3) return 2;
  return 1;
}
