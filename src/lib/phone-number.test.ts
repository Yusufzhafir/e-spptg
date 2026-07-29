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
  ])('accepts %s', (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it.each([
    ['+1 (599) 869-8667', 'a US number'],
    ['+44 7700 900123', 'a UK number'],
    ['12345', 'too short'],
    ['0712345678', 'a landline prefix, not 08'],
    ['08123', 'below the minimum length'],
    ['081234567890123', 'above the maximum length'],
    ['08abcdefghij', 'letters'],
  ])('rejects %s (%s)', (value) => {
    expect(isValidPhoneNumber(value)).toBe(false);
  });
});
