import { describe, expect, it } from 'vitest';
import {
  findAuthenticatedClient,
  isIpAllowed,
  normalizeIp,
  parseAllowedIps,
  parseApiClients,
  resolveClientIp,
  secretsMatch,
} from './clients';

describe('parseApiClients', () => {
  it('parses comma- and newline-separated pairs', () => {
    expect(parseApiClients('dashboard:secret1,bappeda:secret2')).toEqual([
      { clientId: 'dashboard', secret: 'secret1' },
      { clientId: 'bappeda', secret: 'secret2' },
    ]);

    expect(parseApiClients(' dashboard:secret1 \n bappeda:secret2 ')).toEqual([
      { clientId: 'dashboard', secret: 'secret1' },
      { clientId: 'bappeda', secret: 'secret2' },
    ]);
  });

  it('splits on the first colon so a secret may contain colons', () => {
    expect(parseApiClients('dashboard:a:b:c')).toEqual([
      { clientId: 'dashboard', secret: 'a:b:c' },
    ]);
  });

  it('returns nothing when unset or empty', () => {
    expect(parseApiClients(undefined)).toEqual([]);
    expect(parseApiClients(null)).toEqual([]);
    expect(parseApiClients('   ')).toEqual([]);
  });

  it('drops malformed entries instead of throwing', () => {
    // No colon, empty secret, and empty client id respectively.
    expect(parseApiClients('nocolon,empty:,:nosecret,ok:secret')).toEqual([
      { clientId: 'ok', secret: 'secret' },
    ]);
  });

  it('keeps the first definition of a duplicated client id', () => {
    expect(parseApiClients('dashboard:first,dashboard:second')).toEqual([
      { clientId: 'dashboard', secret: 'first' },
    ]);
  });
});

describe('secretsMatch', () => {
  it('accepts an identical secret and rejects anything else', () => {
    expect(secretsMatch('s3cret', 's3cret')).toBe(true);
    expect(secretsMatch('s3cret', 'S3cret')).toBe(false);
    expect(secretsMatch('s3cret', 's3cre')).toBe(false);
    expect(secretsMatch('', 's3cret')).toBe(false);
  });

  it('does not throw on differing lengths', () => {
    // timingSafeEqual rejects unequal buffers; the digests must equalise them.
    expect(() => secretsMatch('a', 'a-much-longer-secret')).not.toThrow();
  });
});

describe('findAuthenticatedClient', () => {
  const clients = parseApiClients('dashboard:secret1,bappeda:secret2');

  it('returns the matching client', () => {
    expect(findAuthenticatedClient(clients, 'bappeda', 'secret2')).toEqual({
      clientId: 'bappeda',
      secret: 'secret2',
    });
  });

  it('rejects a wrong secret, an unknown id, and missing headers alike', () => {
    expect(findAuthenticatedClient(clients, 'dashboard', 'secret2')).toBeNull();
    expect(findAuthenticatedClient(clients, 'tidakada', 'secret1')).toBeNull();
    expect(findAuthenticatedClient(clients, null, 'secret1')).toBeNull();
    expect(findAuthenticatedClient(clients, 'dashboard', null)).toBeNull();
  });

  it("does not let one client's secret authenticate another client", () => {
    expect(findAuthenticatedClient(clients, 'bappeda', 'secret1')).toBeNull();
  });
});

describe('parseAllowedIps / isIpAllowed', () => {
  it('allows everything when the list is empty', () => {
    // Deliberate: the dashboard IP was not known when this shipped.
    expect(isIpAllowed('103.10.20.30', parseAllowedIps(undefined))).toBe(true);
    expect(isIpAllowed(null, [])).toBe(true);
  });

  it('allows only listed addresses once the list is populated', () => {
    const allowed = parseAllowedIps(' 103.10.20.30 , 103.10.20.31 ');
    expect(isIpAllowed('103.10.20.30', allowed)).toBe(true);
    expect(isIpAllowed('103.10.20.31', allowed)).toBe(true);
    expect(isIpAllowed('8.8.8.8', allowed)).toBe(false);
  });

  it('rejects an unknown caller IP when the list is populated', () => {
    expect(isIpAllowed(null, ['103.10.20.30'])).toBe(false);
  });

  it('matches an IPv4-mapped IPv6 address against its plain form', () => {
    expect(normalizeIp('::ffff:103.10.20.30')).toBe('103.10.20.30');
    expect(isIpAllowed('::ffff:103.10.20.30', ['103.10.20.30'])).toBe(true);
  });
});

describe('resolveClientIp', () => {
  const request = (headers: Record<string, string>) =>
    new Request('https://siaptah.test/api/statistik', { headers });

  it('takes the first entry of x-forwarded-for', () => {
    expect(
      resolveClientIp(request({ 'x-forwarded-for': '103.10.20.30, 10.0.0.1' }))
    ).toBe('103.10.20.30');
  });

  it('falls back to x-real-ip, then to null', () => {
    expect(resolveClientIp(request({ 'x-real-ip': '103.10.20.31' }))).toBe(
      '103.10.20.31'
    );
    expect(resolveClientIp(request({}))).toBeNull();
  });
});
