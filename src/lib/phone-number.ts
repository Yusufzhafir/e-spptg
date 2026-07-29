/**
 * Indonesian mobile numbers, the way people actually type them.
 *
 * Officers copy numbers out of WhatsApp, spreadsheets and paper forms, so the
 * input arrives with spaces, dots, dashes, brackets or a +62 prefix. We accept
 * all of those, store one canonical shape (08xxxxxxxxxx), and reject anything
 * that is not an Indonesian mobile number — a foreign number such as
 * "+1 (599) 869-8667" must not slip through.
 */

/** 08 followed by 8–11 digits (10–13 digits in total). */
const INDONESIAN_MOBILE = /^08[0-9]{8,11}$/;

/**
 * Strip formatting and rewrite an international prefix to the local 0 form.
 * Returns the input trimmed (not blanked) when it cannot be interpreted, so the
 * validator can still show the user what they typed.
 */
export function normalizePhoneNumber(raw: string): string {
  const compact = raw.replace(/[\s().\-]/g, '');
  if (!compact) return '';

  // +62xxx / 62xxx → 0xxx. Only for 628…, so +1 (a US number) is left alone
  // and then fails validation instead of being mangled into something valid.
  const withoutIdCode = compact.replace(/^(?:\+62|62)(?=8)/, '0');

  return withoutIdCode;
}

/** True when the value is a well-formed Indonesian mobile number. */
export function isValidPhoneNumber(value: string): boolean {
  return INDONESIAN_MOBILE.test(normalizePhoneNumber(value));
}

/** Single message so the form, the schema and the tests never drift apart. */
export const PHONE_NUMBER_ERROR =
  'Nomor HP harus format Indonesia, contoh 081234567890';
