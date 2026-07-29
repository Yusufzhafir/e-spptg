import { describe, expect, it } from 'vitest';
import { isValidEmail, normalizeEmail } from './email-address';

describe('isValidEmail', () => {
  it.each([
    'budi@email.com',
    'budi.santoso@desa.go.id',
    'budi+spptg@email.co.id',
    'budi_123@sub.domain.com',
  ])('accepts %s', (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  it.each([
    ['budi[at]email.com', 'no @'],
    ['budi@', 'no domain'],
    ['@email.com', 'no local part'],
    ['budi@email', 'no TLD'],
    ['budi@email.c', 'one-letter TLD'],
    ['budi santoso@email.com', 'a space'],
    ['budi@@email.com', 'a double @'],
    ['budi..santoso@email.com', 'a double dot'],
    ['budi@email.com.', 'a trailing dot'],
    ['', 'empty'],
  ])('rejects %s (%s)', (value) => {
    expect(isValidEmail(value)).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Budi@Email.COM ')).toBe('budi@email.com');
  });
});
