import {
  clearedFlowCookie,
  codeChallengeS256,
  createFlowState,
  flowCookie,
  nipNikFrom,
  normalizeIdentity,
  pendingLinkCookie,
  readFlowState,
  readPendingLink,
  refusalReason,
  SsoError,
  type SsoIdentity,
} from './sso';
import type { SsoConfig } from '@/lib/sso-config';

const config: SsoConfig = {
  issuer: 'https://sso.kutaitimurkab.go.id/auth/realms/kutimkab',
  clientId: 'siaptah',
  clientSecret: 'rahasia-uji',
  redirectUri: 'https://siaptah.kutaitimurkab.go.id/callbacksso',
  allowedEmailDomains: ['kutaitimurkab.go.id'],
  prompt: '',
};

/** Pull the cookie's value out of a Set-Cookie string. */
function cookieValue(setCookie: string): string {
  return setCookie.slice(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));
}

const identity: SsoIdentity = {
  sub: '5f1c2a6e-0000-4000-8000-000000000000',
  email: 'budi@kutaitimurkab.go.id',
  nama: 'Budi Santoso',
  nip: '198501012010011001',
  nik: null,
  userType: 'asn',
  nomorHP: null,
  approvalStatus: 'approved',
};

describe('codeChallengeS256', () => {
  it('cocok dengan vektor uji RFC 7636', () => {
    expect(codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });

  it('tidak memakai padding base64 biasa', () => {
    expect(codeChallengeS256('apa saja')).not.toContain('=');
  });
});

describe('createFlowState', () => {
  it('membuat verifier sepanjang yang diizinkan RFC 7636 (43-128)', () => {
    const state = createFlowState('/app');
    expect(state.verifier.length).toBeGreaterThanOrEqual(43);
    expect(state.verifier.length).toBeLessThanOrEqual(128);
  });

  it('tidak pernah mengulang state', () => {
    const states = new Set(Array.from({ length: 50 }, () => createFlowState('/app').state));
    expect(states.size).toBe(50);
  });
});

describe('cookie handshake', () => {
  it('bolak-balik utuh', () => {
    const state = createFlowState('/app/pengajuan');
    const restored = readFlowState(cookieValue(flowCookie(state, config)), config);
    expect(restored).toEqual(state);
  });

  it('menolak isi yang diubah', () => {
    const state = createFlowState('/app');
    const raw = cookieValue(flowCookie(state, config));
    const tampered = Buffer.from(
      JSON.stringify({ ...state, next: 'https://jahat.example' })
    ).toString('base64url');

    // Inilah yang menahan login CSRF: penyerang bisa menanam cookie, tapi tidak
    // bisa memalsukan tanda tangannya.
    expect(readFlowState(`${tampered}.${raw.slice(raw.lastIndexOf('.') + 1)}`, config)).toBeNull();
  });

  it('menolak tanda tangan dari kunci lain', () => {
    const state = createFlowState('/app');
    const raw = cookieValue(flowCookie(state, config));
    expect(readFlowState(raw, { ...config, clientSecret: 'kunci-lain' })).toBeNull();
  });

  it('menolak masukan kosong atau tanpa tanda tangan', () => {
    expect(readFlowState(undefined, config)).toBeNull();
    expect(readFlowState('', config)).toBeNull();
    expect(readFlowState('tanpatitik', config)).toBeNull();
  });

  it('cookie penghapus tidak menyisakan masa berlaku', () => {
    expect(clearedFlowCookie()).toContain('Max-Age=0');
  });

  it('pending link juga tertanda tangan', () => {
    const link = { sub: 'abc', email: 'budi@kutaitimurkab.go.id', nama: 'Budi', next: '/app' };
    const raw = cookieValue(pendingLinkCookie(link, config));
    expect(readPendingLink(raw, config)).toEqual(link);

    // Menukar email di sini sama dengan mengambil alih akun orang lain.
    const forged = Buffer.from(
      JSON.stringify({ ...link, email: 'superadmin@kutaitimurkab.go.id' })
    ).toString('base64url');
    expect(readPendingLink(`${forged}.${raw.slice(raw.lastIndexOf('.') + 1)}`, config)).toBeNull();
  });
});

describe('normalizeIdentity', () => {
  it('memetakan claim sesuai manual Diskominfo', () => {
    expect(
      normalizeIdentity({
        sub: 'uuid-1',
        email: 'Budi@Kutaitimurkab.go.id',
        name: 'Budi Santoso',
        nip: '1985',
        nik: null,
        user_type: 'asn',
        phone_number: '08123',
        approval_status: 'approved',
      })
    ).toEqual({
      sub: 'uuid-1',
      email: 'budi@kutaitimurkab.go.id',
      nama: 'Budi Santoso',
      nip: '1985',
      nik: null,
      userType: 'asn',
      nomorHP: '08123',
      approvalStatus: 'approved',
    });
  });

  it('memakai bagian depan email kalau name kosong', () => {
    // `users.nama` NOT NULL — menyimpan string kosong bukan pilihan.
    expect(normalizeIdentity({ sub: 'x', email: 'budi@kutaitimurkab.go.id' }).nama).toBe('budi');
  });

  it('menolak payload tanpa sub atau email', () => {
    expect(() => normalizeIdentity({ email: 'a@b.go.id' })).toThrow(SsoError);
    expect(() => normalizeIdentity({ sub: 'x' })).toThrow(SsoError);
    expect(() => normalizeIdentity({ sub: 'x', email: '   ' })).toThrow(SsoError);
  });
});

describe('refusalReason', () => {
  it('meloloskan akun yang sudah disetujui di domain kabupaten', () => {
    expect(refusalReason(identity, config)).toBeNull();
  });

  it('menolak akun yang belum disetujui', () => {
    expect(refusalReason({ ...identity, approvalStatus: 'pending' }, config)).toMatch(
      /belum disetujui/i
    );
    expect(refusalReason({ ...identity, approvalStatus: 'rejected' }, config)).not.toBeNull();
  });

  it('meloloskan akun tanpa approval_status — klaimnya opsional', () => {
    expect(refusalReason({ ...identity, approvalStatus: null }, config)).toBeNull();
  });

  it('menolak email di luar domain yang diizinkan', () => {
    expect(refusalReason({ ...identity, email: 'budi@gmail.com' }, config)).toMatch(/hanya untuk/i);
  });
});

describe('nipNikFrom', () => {
  it('memakai NIP untuk ASN dan NIK untuk warga', () => {
    expect(nipNikFrom(identity)).toBe('198501012010011001');
    expect(nipNikFrom({ ...identity, nip: null, nik: '6401010101010001' })).toBe(
      '6401010101010001'
    );
  });

  it('memberi tanda hubung, bukan nomor karangan, kalau keduanya kosong', () => {
    expect(nipNikFrom({ ...identity, nip: null, nik: null })).toBe('-');
  });

  it('memotong sesuai lebar kolom varchar(20)', () => {
    expect(nipNikFrom({ ...identity, nip: '9'.repeat(40) })).toHaveLength(20);
  });
});
