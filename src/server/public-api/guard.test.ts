import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearRateLimits } from '@/server/auth/rate-limit';
import { API_KEY_HEADER, CLIENT_ID_HEADER, authenticateApiRequest } from './guard';

function request(headers: Record<string, string> = {}) {
  return new Request('https://siaptah.test/api/statistik/ringkasan', { headers });
}

const VALID = {
  [CLIENT_ID_HEADER]: 'dashboard-eksekutif',
  [API_KEY_HEADER]: 'rahasia-panjang',
};

describe('authenticateApiRequest', () => {
  beforeEach(async () => {
    await __clearRateLimits();
    process.env.STATISTIK_API_CLIENTS = 'dashboard-eksekutif:rahasia-panjang';
    delete process.env.STATISTIK_API_ALLOWED_IPS;
    // The "allowlist is empty" warning is expected in most of these cases.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.STATISTIK_API_CLIENTS;
    delete process.env.STATISTIK_API_ALLOWED_IPS;
    vi.restoreAllMocks();
  });

  it('accepts a correct client id and key', async () => {
    const result = await authenticateApiRequest(request(VALID));
    expect(result).toEqual({ ok: true, clientId: 'dashboard-eksekutif' });
  });

  it('fails closed with 503 when no clients are configured', async () => {
    delete process.env.STATISTIK_API_CLIENTS;
    const result = await authenticateApiRequest(request(VALID));
    expect(result).toMatchObject({ ok: false, status: 503, kode: 'API_BELUM_DIKONFIGURASI' });
  });

  it('rejects a missing, unknown or wrong credential with 401', async () => {
    expect(await authenticateApiRequest(request())).toMatchObject({ status: 401 });
    expect(
      await authenticateApiRequest(
        request({ ...VALID, [CLIENT_ID_HEADER]: 'penyusup' })
      )
    ).toMatchObject({ status: 401 });
    expect(
      await authenticateApiRequest(request({ ...VALID, [API_KEY_HEADER]: 'salah' }))
    ).toMatchObject({ status: 401 });
  });

  it('rejects an unlisted IP once the allowlist is set', async () => {
    process.env.STATISTIK_API_ALLOWED_IPS = '103.10.20.30';

    expect(
      await authenticateApiRequest(request({ ...VALID, 'x-forwarded-for': '8.8.8.8' }))
    ).toMatchObject({ status: 403, kode: 'IP_TIDAK_DIIZINKAN' });

    expect(
      await authenticateApiRequest(
        request({ ...VALID, 'x-forwarded-for': '103.10.20.30, 10.0.0.1' })
      )
    ).toEqual({ ok: true, clientId: 'dashboard-eksekutif' });
  });

  it('checks the IP before the credentials, so it cannot be used to probe client ids', async () => {
    process.env.STATISTIK_API_ALLOWED_IPS = '103.10.20.30';

    // Valid id + wrong key and unknown id + wrong key must be indistinguishable
    // from off-network: both 403, never 401.
    expect(
      await authenticateApiRequest(
        request({ ...VALID, [API_KEY_HEADER]: 'salah', 'x-forwarded-for': '8.8.8.8' })
      )
    ).toMatchObject({ status: 403 });
  });

  it('throttles a client that floods the endpoint', async () => {
    for (let i = 0; i < 120; i += 1) {
      expect((await authenticateApiRequest(request(VALID))).ok).toBe(true);
    }

    const throttled = await authenticateApiRequest(request(VALID));
    expect(throttled).toMatchObject({ status: 429, kode: 'TERLALU_BANYAK_PERMINTAAN' });
    expect(throttled.ok).toBe(false);
    if (!throttled.ok) expect(throttled.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('throttles per client, so one consumer cannot lock out another', async () => {
    process.env.STATISTIK_API_CLIENTS =
      'dashboard-eksekutif:rahasia-panjang,bappeda:rahasia-lain';

    for (let i = 0; i < 121; i += 1) await authenticateApiRequest(request(VALID));

    expect(
      (
        await authenticateApiRequest(
          request({ [CLIENT_ID_HEADER]: 'bappeda', [API_KEY_HEADER]: 'rahasia-lain' })
        )
      ).ok
    ).toBe(true);
  });
});
