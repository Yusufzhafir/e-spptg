import { describe, expect, it } from 'vitest';
import { isValidPhoneNumber, normalizePhoneNumber } from './phone-number';

describe('normalizePhoneNumber', () => {
  it.each([
    ['0812 3456 7890', '081234567890'],
    ['0812-3456-7890', '081234567890'],
    ['+62 812 3456 7890', '081234567890'],
    ['62812 3456 7890', '081234567890'],
    ['(0812) 3456-7890', '081234567890'],
    // The trunk 0 people leave in after the country code.
    ['+62 0812 3456 7890', '081234567890'],
    ['0062 812 3456 7890', '081234567890'],
  ])('rewrites %s to the canonical 08 form', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it.each([
    ['021 1234 5678', '02112345678'],
    ['(021) 123-4567', '0211234567'],
    ['+62 21 1234 5678', '02112345678'],
    ['6221 1234567', '0211234567'],
  ])('rewrites %s to the canonical 021 form', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it.each([
    ['0511 330 1234', '05113301234'],
    ['(0541) 733-333', '0541733333'],
    ['+62 561 123456', '0561123456'],
    ['62511 3301234', '05113301234'],
  ])('rewrites %s to the canonical 05 form', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it('leaves a foreign number alone instead of mangling it into a valid one', () => {
    // Stripping "+1" would turn this into a plausible local number.
    expect(normalizePhoneNumber('+1 (599) 869-8667')).toBe('+15998698667');
  });
});

describe('isValidPhoneNumber', () => {
  it.each([
    '081234567890',
    '08123456789',
    '0812345678',
    '0895123456789',
    '+62 812 3456 7890',
    '0812-3456-7890',
  ])('accepts mobile %s', (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it.each([
    ['0211234567', 'Jakarta'],
    ['02112345678', 'Jakarta, 8-digit subscriber'],
    ['(021) 123-4567', 'Jakarta, formatted'],
    ['+62 21 1234 5678', 'Jakarta, country code'],
    ['0221234567', 'Bandung'],
    ['0241234567', 'Semarang'],
    ['0311234567', 'Surabaya'],
    ['0611234567', 'Medan'],
  ])('accepts metro landline %s (%s)', (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it.each([
    ['0549123456', 'Sangatta — the kabupaten this app serves'],
    ['0541733333', 'Samarinda'],
    ['05113301234', 'Banjarmasin'],
    ['0561123456', 'Pontianak'],
    ['0251123456', 'Bogor'],
    ['0274123456', 'Yogyakarta'],
    ['0361123456', 'Denpasar'],
    ['0411123456', 'Makassar'],
    ['0711123456', 'Palembang'],
    ['0967123456', 'Jayapura'],
    ['0651123456', 'Banda Aceh'],
    ['(0541) 733-333', 'formatted'],
    ['+62 561 123456', 'country code'],
  ])('accepts regional landline %s (%s)', (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it.each([
    ['+1 (599) 869-8667', 'a US number'],
    ['+44 7700 900123', 'a UK number'],
    ['12345', 'too short'],
    ['0112345678', 'no 01x area code exists — 01x is the service range'],
    ['0012345678', 'no 00x area code exists'],
    ['0800123456', '080x is toll-free/premium, not a contact number'],
    ['08123', 'below the minimum mobile length'],
    ['081234567890123', 'above the maximum mobile length'],
    ['021123456', 'a 021 number below the minimum length'],
    ['021123456789', 'a 021 number above the maximum length'],
    ['05113301', 'a 05 number below the minimum length'],
    ['0541733333333', 'a 05 number above the maximum length'],
    ['05abcdefghi', 'letters'],
    ['08abcdefghij', 'letters'],
  ])('rejects %s (%s)', (value) => {
    expect(isValidPhoneNumber(value)).toBe(false);
  });
});
