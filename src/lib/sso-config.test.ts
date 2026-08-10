import { getSsoConfig, isAllowedSsoEmail, parseEmailDomains, ssoEndpoints } from './sso-config';

/** Minimum env for a working config, so each test only states what it changes. */
function env(overrides: Record<string, string | undefined> = {}) {
  return {
    SSO_ENABLED: 'true',
    SSO_ISSUER: 'https://sso.kutaitimurkab.go.id/auth/realms/kutimkab',
    SSO_CLIENT_ID: 'siaptah',
    SSO_REDIRECT_URI: 'https://siaptah.kutaitimurkab.go.id/callbacksso',
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getSsoConfig', () => {
  it('mati secara bawaan', () => {
    expect(getSsoConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('menerima berbagai penulisan nilai true', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', 'on']) {
      expect(getSsoConfig(env({ SSO_ENABLED: value }))).not.toBeNull();
    }
  });

  it('mati untuk nilai selain true', () => {
    for (const value of ['false', '0', 'no', '', 'aktif']) {
      expect(getSsoConfig(env({ SSO_ENABLED: value }))).toBeNull();
    }
  });

  it('mati — bukan setengah jalan — kalau konfigurasinya tidak lengkap', () => {
    expect(getSsoConfig(env({ SSO_CLIENT_ID: '' }))).toBeNull();
    expect(getSsoConfig(env({ SSO_ISSUER: '' }))).toBeNull();
    expect(getSsoConfig(env({ SSO_REDIRECT_URI: '' }))).toBeNull();
    // Diam-diam mati adalah kesalahan operasional yang sulit dilacak.
    expect(console.error).toHaveBeenCalled();
  });

  it('membuang garis miring di akhir issuer supaya endpoint tidak dobel', () => {
    const config = getSsoConfig(
      env({ SSO_ISSUER: 'https://sso.kutaitimurkab.go.id/auth/realms/kutimkab/' })
    );
    expect(config?.issuer).toBe('https://sso.kutaitimurkab.go.id/auth/realms/kutimkab');
    expect(ssoEndpoints(config!.issuer).token).toBe(
      'https://sso.kutaitimurkab.go.id/auth/realms/kutimkab/protocol/openid-connect/token'
    );
  });

  it('membatasi ke domain kabupaten kalau tidak diatur', () => {
    expect(getSsoConfig(env())?.allowedEmailDomains).toEqual(['kutaitimurkab.go.id']);
  });

  it('mengizinkan semua domain hanya kalau dikosongkan secara eksplisit', () => {
    expect(getSsoConfig(env({ SSO_ALLOWED_EMAIL_DOMAINS: '' }))?.allowedEmailDomains).toEqual([]);
  });

  it('meneruskan prompt untuk memaksa layar login SSO', () => {
    expect(getSsoConfig(env({ SSO_PROMPT: 'login' }))?.prompt).toBe('login');
    expect(getSsoConfig(env())?.prompt).toBe('');
  });
});

describe('parseEmailDomains', () => {
  it('memisah, merapikan, dan membuang @ di depan', () => {
    expect(parseEmailDomains(' @Kutaitimurkab.go.id , diskominfo.go.id ')).toEqual([
      'kutaitimurkab.go.id',
      'diskominfo.go.id',
    ]);
  });

  it('menghasilkan daftar kosong untuk masukan kosong', () => {
    expect(parseEmailDomains(undefined)).toEqual([]);
    expect(parseEmailDomains(' , ')).toEqual([]);
  });
});

describe('isAllowedSsoEmail', () => {
  const domains = ['kutaitimurkab.go.id'];

  it('menerima domain persis, apa pun besar-kecil hurufnya', () => {
    expect(isAllowedSsoEmail('Budi@Kutaitimurkab.go.id', domains)).toBe(true);
  });

  it('menerima subdomain instansi', () => {
    expect(isAllowedSsoEmail('budi@diskominfo.kutaitimurkab.go.id', domains)).toBe(true);
  });

  it('menolak domain yang hanya mirip', () => {
    // Justru kasus inilah yang lolos kalau memakai endsWith polos.
    expect(isAllowedSsoEmail('budi@notkutaitimurkab.go.id', domains)).toBe(false);
    expect(isAllowedSsoEmail('budi@kutaitimurkab.go.id.evil.com', domains)).toBe(false);
  });

  it('menolak email publik saat daftar domain diisi', () => {
    expect(isAllowedSsoEmail('budi@gmail.com', domains)).toBe(false);
  });

  it('menerima apa pun saat daftar domain kosong', () => {
    expect(isAllowedSsoEmail('budi@gmail.com', [])).toBe(true);
  });

  it('menolak masukan yang bukan email', () => {
    expect(isAllowedSsoEmail('budi', domains)).toBe(false);
    expect(isAllowedSsoEmail('budi@', domains)).toBe(false);
  });
});
