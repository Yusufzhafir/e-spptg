/**
 * A certificate number carries the decision it was issued under:
 * `TERDAFTAR/SPPTG/<nomor>` for an approved berkas, `TERDATA/SPPTG/<nomor>` for
 * one issued while still only recorded. The prefix is not something a petugas
 * types or may remove — it is part of what the number *is*, so the form renders
 * it as a fixed label and only ever stores it back joined to what was typed.
 */
export const NOMOR_SPPTG_PREFIX_TERDAFTAR = 'TERDAFTAR/SPPTG/';
export const NOMOR_SPPTG_PREFIX_TERDATA = 'TERDATA/SPPTG/';

/** The prefix a berkas must use, given its Step 3 decision. */
export function nomorSPPTGPrefix(status: string | null | undefined): string {
  return status === 'SPPTG terdata'
    ? NOMOR_SPPTG_PREFIX_TERDATA
    : NOMOR_SPPTG_PREFIX_TERDAFTAR;
}

/**
 * What to call the certificate a decision produces, on screen.
 *
 * Kept beside `nomorSPPTGPrefix` because both switch on the same status: a label
 * saying "SPPTG Terdata" over a field prefixed `TERDAFTAR/SPPTG/` would be worse
 * than either mistake alone, and side-by-side they cannot drift apart.
 *
 * Falls back to the bare name before a decision exists — Step 4 is still named
 * in the stepper then, and naming a certificate that cannot be issued yet would
 * be a guess.
 */
export function certificateLabel(status: string | null | undefined): string {
  if (status === 'SPPTG terdata') return 'SPPTG Terdata';
  if (status === 'SPPTG terdaftar') return 'SPPTG Terdaftar';
  return 'SPPTG';
}

/**
 * Leads that a prefix already supplies. Both full prefixes appear here so a
 * number survives a change of decision on Step 3: switching terdaftar → terdata
 * re-prefixes the same nomor instead of burying the old prefix inside it.
 */
const REDUNDANT_LEADS = [
  NOMOR_SPPTG_PREFIX_TERDAFTAR,
  NOMOR_SPPTG_PREFIX_TERDATA,
  'TERDAFTAR/',
  'TERDATA/',
  'SPPTG/',
];

/** Strips every lead a prefix would supply, plus the separators around them. */
function stripRedundantLeads(value: string): string {
  let rest = value.replace(/^[\s/]+/, '');
  let previous: string;

  do {
    previous = rest;
    const upper = rest.toUpperCase();
    const lead = REDUNDANT_LEADS.find((candidate) => upper.startsWith(candidate));
    if (lead) {
      rest = rest.slice(lead.length).replace(/^[\s/]+/, '');
    }
  } while (rest !== previous);

  return rest;
}

/**
 * The editable half of a stored nomor — what belongs in the input box.
 *
 * A value written before the prefixes existed has nothing to strip, so it is
 * returned whole and becomes the body of the new format the moment it is saved
 * again. That is the intended migration: the prefix is added, the number the
 * desa recorded is kept.
 */
export function nomorSPPTGBody(value: string | null | undefined): string {
  return stripRedundantLeads((value ?? '').trim());
}

/**
 * Rebuilds the full nomor from what the user typed, under the prefix its status
 * calls for. Any lead the prefix already covers is absorbed rather than doubled.
 */
export function withNomorSPPTGPrefix(body: string, status?: string | null): string {
  return nomorSPPTGPrefix(status) + stripRedundantLeads(body);
}

/**
 * Whether a nomor carries an actual number, not just the prefix. The prefix is
 * seeded into the field, so a plain emptiness check would let a certificate be
 * issued with no number at all.
 */
export function hasNomorSPPTGBody(value: string | null | undefined): boolean {
  return nomorSPPTGBody(value).length > 0;
}
