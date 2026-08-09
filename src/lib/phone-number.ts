/**
 * Indonesian phone numbers, the way people actually type them.
 *
 * Officers copy numbers out of WhatsApp, spreadsheets and paper forms, so the
 * input arrives with spaces, dots, dashes, brackets or a +62 prefix. We accept
 * all of those, store one canonical shape (08… / 021… / 0549…), and reject
 * anything that is not an Indonesian number — a foreign number such as
 * "+1 (599) 869-8667" must not slip through.
 *
 * The whole national numbering plan is accepted, not a hand-picked few area
 * codes: citizens give a mobile number, while desa offices and instansi still
 * list a landline, and those landlines sit anywhere from 0211 (Jakarta) to
 * 0549 (Sangatta) to 0967 (Jayapura). What is checked is the *shape* — trunk
 * prefix, plausible area code, subscriber length — not membership of the
 * assigned-code registry, which would need a ~200-entry table that drifts every
 * time Kominfo publishes an update.
 */

/**
 * Mobile: 08 + operator digit + subscriber, 10–13 digits in total. Covers every
 * operator prefix in use (0811…0859, 0877, 0881…, 0895…). The 080x range is
 * toll-free/premium service numbers rather than a personal contact, so it is
 * deliberately out.
 */
const MOBILE = /^08[1-9][0-9]{6,10}$/;

/**
 * Landline, metro: the five two-digit area codes — 21 Jakarta, 22 Bandung,
 * 24 Semarang, 31 Surabaya, 61 Medan — each with a 7–8 digit subscriber number,
 * so 10–11 digits in total (0211234567, 02112345678).
 */
const METRO_LANDLINE = /^0(?:21|22|24|31|61)[0-9]{7,8}$/;

/**
 * Landline, everywhere else: a three-digit area code with a 5–8 digit
 * subscriber number, 9–12 digits in total — 0251 Bogor, 0274 Yogyakarta,
 * 0361 Denpasar, 0411 Makassar, 0511 Banjarmasin, 0541 Samarinda, 0549 Sangatta,
 * 0711 Palembang, 0967 Jayapura, and so on.
 *
 * The digit after the trunk 0 is 2–7 or 9: 0 and 1 open no area code (01x is
 * reserved for service numbers) and 8 is the mobile range above. The two-digit
 * metro codes are excluded here so their stricter subscriber length is the one
 * that applies.
 */
const REGIONAL_LANDLINE =
  /^0(?:2[035-9]|3[02-9]|4[0-9]|5[0-9]|6[02-9]|7[0-9]|9[0-9])[0-9][0-9]{5,8}$/;

/**
 * Strip formatting and rewrite an international prefix to the local 0 form.
 * Returns the input trimmed (not blanked) when it cannot be interpreted, so the
 * validator can still show the user what they typed.
 */
export function normalizePhoneNumber(raw: string): string {
  const compact = raw.replace(/[\s().\-]/g, '');
  if (!compact) return '';

  // +62… / 62… / 0062… → 0…, and the redundant trunk 0 people leave in when
  // they write "+62 0812…" collapses into that same single 0. Only applied when
  // what follows can begin an Indonesian number (2–9), so a US "+1 (599) …" is
  // left alone and then fails validation, instead of being mangled into
  // something that looks local and valid.
  const withoutIdCode = compact.replace(/^(?:\+62|0062|62)0?(?=[2-9])/, '0');

  return withoutIdCode;
}

/** True when the value is a well-formed Indonesian mobile or landline number. */
export function isValidPhoneNumber(value: string): boolean {
  const normalized = normalizePhoneNumber(value);
  return (
    MOBILE.test(normalized) ||
    METRO_LANDLINE.test(normalized) ||
    REGIONAL_LANDLINE.test(normalized)
  );
}

/** Single message so the form, the schema and the tests never drift apart. */
export const PHONE_NUMBER_ERROR =
  'Nomor telepon harus nomor Indonesia, contoh 081234567890 (HP), 0211234567 atau 0549123456 (telepon kantor)';
