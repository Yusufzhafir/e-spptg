/**
 * Indonesian phone numbers, the way people actually type them.
 *
 * Officers copy numbers out of WhatsApp, spreadsheets and paper forms, so the
 * input arrives with spaces, dots, dashes, brackets or a +62 prefix. We accept
 * all of those, store one canonical shape (08… / 021…), and reject anything
 * that is not an Indonesian number — a foreign number such as
 * "+1 (599) 869-8667" must not slip through.
 *
 * Three prefixes are accepted: mobile (08), the Jakarta area code (021), and the
 * 05 area codes (0511 Banjarmasin, 0541 Samarinda, 0561 Pontianak, …). Desa
 * offices and instansi still list a landline as their contact number.
 */

/** 08 followed by 8–11 digits (10–13 digits in total). */
const INDONESIAN_MOBILE = /^08[0-9]{8,11}$/;

/** 021 followed by the 7–8 digit Jakarta subscriber number. */
const JAKARTA_LANDLINE = /^021[0-9]{7,8}$/;

/**
 * 05xx area code (4 digits) plus a 6–7 digit subscriber number — 10–11 digits in
 * total, e.g. 0541733333 or 05113301234.
 */
const AREA_05_LANDLINE = /^05[0-9]{8,9}$/;

/**
 * Strip formatting and rewrite an international prefix to the local 0 form.
 * Returns the input trimmed (not blanked) when it cannot be interpreted, so the
 * validator can still show the user what they typed.
 */
export function normalizePhoneNumber(raw: string): string {
  const compact = raw.replace(/[\s().\-]/g, '');
  if (!compact) return '';

  // +62xxx / 62xxx → 0xxx, but only for the prefixes we actually accept (8…,
  // 21… and 5…). A US "+1 (599) …" is left alone and then fails validation,
  // instead of being mangled into something that looks local and valid.
  const withoutIdCode = compact.replace(/^(?:\+62|62)(?=8|21|5)/, '0');

  return withoutIdCode;
}

/** True when the value is a well-formed Indonesian 08 / 021 / 05 number. */
export function isValidPhoneNumber(value: string): boolean {
  const normalized = normalizePhoneNumber(value);
  return (
    INDONESIAN_MOBILE.test(normalized) ||
    JAKARTA_LANDLINE.test(normalized) ||
    AREA_05_LANDLINE.test(normalized)
  );
}

/** Single message so the form, the schema and the tests never drift apart. */
export const PHONE_NUMBER_ERROR =
  'Nomor telepon harus diawali 08, 021, atau 05, contoh 081234567890 atau 0211234567';
