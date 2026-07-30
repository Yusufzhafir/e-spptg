import { describe, expect, it } from 'vitest';
import { isValidPhoneNumber, normalizePhoneNumber } from './phone-number';

describe('normalizePhoneNumber', () => {
  it.each([
    ['0812 3456 7890', '081234567890'],
    ['0812-3456-7890', '081234567890'],
    ['+62 812 3456 7890', '081234567890'],
    ['62812 3456 7890', '081234567890'],
    ['(0812) 3456-7890', '081234567890'],
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
    '+62 812 3456 7890',
    '0812-3456-7890',
  ])('accepts mobile %s', (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it.each([
    '0211234567',
    '02112345678',
    '021 1234 5678',
    '(021) 123-4567',
    '+62 21 1234 5678',
  ])('accepts Jakarta landline %s', (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it.each([
    '0511330123',
    '05113301234',
    '0541733333',
    '(0541) 733-333',
    '+62 561 123456',
  ])('accepts 05 area code %s', (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it.each([
    ['+1 (599) 869-8667', 'a US number'],
    ['+44 7700 900123', 'a UK number'],
    ['12345', 'too short'],
    ['0712345678', 'an area code we do not accept — only 08, 021 and 05'],
    ['0221234567', 'Bandung, not 021'],
    ['08123', 'below the minimum length'],
    ['081234567890123', 'above the maximum length'],
    ['021123456', 'a 021 number below the minimum length'],
    ['021123456789', 'a 021 number above the maximum length'],
    ['05113301', 'a 05 number below the minimum length'],
    ['051133012345', 'a 05 number above the maximum length'],
    ['05abcdefghi', 'letters'],
    ['08abcdefghij', 'letters'],
  ])('rejects %s (%s)', (value) => {
    expect(isValidPhoneNumber(value)).toBe(false);
  });
});
