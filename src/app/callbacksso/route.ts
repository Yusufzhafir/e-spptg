import { NextResponse, type NextRequest } from 'next/server';
import {
  SSO_FLOW_COOKIE_NAME,
  clearedFlowCookie,
  fetchIdentity,
  getSsoConfig,
  nipNikFrom,
  pendingLinkCookie,
  readFlowState,
  refusalReason,
  type SsoIdentity,
} from '@/server/auth/sso';
import { SSO_SOURCE } from '@/lib/sso-config';
import { SITE_URL } from '@/lib/site';
import { completeSsoSignIn, requestMeta } from '@/server/auth/sso-login';
import { createUser, getUserByEmail, getUserBySsoSub } from '@/server/db/queries/user';
import { recordAudit } from '@/server/audit/record';
import type { SsoErrorCode } from '@/lib/sso-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Step 2 of the SSO handshake — the redirect URI registered with Diskominfo as
 * `https://siaptah.kutaitimurkab.go.id/callbacksso`.
 *
 * The path is fixed by that registration, which is why this route sits at the
 * top level instead of under `/api`. Keycloak refuses the whole login on any
 * difference in scheme, port or trailing slash, so do not "tidy" it.
 *
 * Every redirect out of here is built on `SITE_URL`, never on `request.url`.
 * Behind nginx the standalone server sees its own bind address, so `request.url`
 * is `https://0.0.0.0:3000/…` — a Location header no browser can follow, which
 * breaks the final hop of a login that otherwise succeeded.
 *
 * Account resolution follows section 4 of the manual, in this order:
 *   1. `sso_sub` matches  → sign in
 *   2. email matches      → ask before linking (never link silently)
 *   3. neither            → create the account from the SSO claims
 */
export async function GET(request: NextRequest) {
  const config = getSsoConfig();
  if (!config) return new NextResponse('Not found', { status: 404 });

  const meta = requestMeta(request);
  const params = request.nextUrl.searchParams;

  const flow = readFlowState(request.cookies.get(SSO_FLOW_COOKIE_NAME)?.value, config);
  const code = params.get('code');

  // Keycloak reports its own refusals here (`access_denied` when someone hits
  // "batal" on the login page, and so on).
  if (params.get('error')) {
    return failure('gagal', `SSO menolak permintaan: ${params.get('error')}`);
  }

  // The state check is what makes this handshake non-forgeable: without it a
  // crafted `/callbacksso?code=…` link could sign a visitor into somebody else's
  // account. A missing cookie means the flow expired or never started here.
  if (!flow || !code || flow.state !== params.get('state')) {
    return failure('kadaluarsa', 'State SSO tidak cocok atau sudah kedaluwarsa.');
  }

  let identity: SsoIdentity;
  try {
    identity = await fetchIdentity(config, code, flow.verifier);
  } catch (error) {
    console.error('[sso] Penukaran code gagal:', error);
    return failure('gagal', 'Penukaran authorization code gagal.');
  }

  const refusal = refusalReason(identity, config);
  if (refusal) {
    await recordSsoFailure(identity, refusal, meta);
    return failure(
      identity.approvalStatus && identity.approvalStatus !== 'approved'
        ? 'belum-disetujui'
        : 'domain',
      refusal
    );
  }

  // 1. Already linked — the fast path every login after the first one takes.
  const linked = await getUserBySsoSub(identity.sub);
  if (linked) {
    if (linked.status !== 'Aktif') {
      await recordSsoFailure(identity, 'Akun dinonaktifkan', meta);
      return failure('nonaktif', 'Akun dinonaktifkan.');
    }
    return signedIn(
      flow.next,
      await completeSsoSignIn(linked, meta, `${linked.nama} masuk lewat SSO Kutai Timur`)
    );
  }

  // 2. The address is known but has never been linked. Confirm first: linking on
  //    sight would let anyone who can authenticate as this address at the IdP
  //    take over the local account without the owner ever being asked.
  const existing = await getUserByEmail(identity.email);
  if (existing) {
    if (existing.status !== 'Aktif') {
      await recordSsoFailure(identity, 'Akun dinonaktifkan', meta);
      return failure('nonaktif', 'Akun dinonaktifkan.');
    }

    const response = NextResponse.redirect(new URL('/sso/hubungkan', SITE_URL));
    response.headers.append(
      'set-cookie',
      pendingLinkCookie(
        { sub: identity.sub, email: identity.email, nama: identity.nama, next: flow.next },
        config
      )
    );
    response.headers.append('set-cookie', clearedFlowCookie());
    return response;
  }

  // 3. Brand new person. Always 'Viewer', exactly like self-registration: the
  //    SSO `roles` claim describes the realm, not this app, and honouring it
  //    would let the IdP mint a Superadmin here. An admin promotes from
  //    Pengaturan afterwards.
  const created = await createNewSsoUser(identity);
  if (!created) {
    return failure('gagal', 'Pembuatan akun dari data SSO gagal.');
  }

  return signedIn(
    flow.next,
    await completeSsoSignIn(
      created,
      meta,
      `${created.nama} masuk lewat SSO Kutai Timur (akun baru dibuat otomatis)`
    )
  );
}

async function createNewSsoUser(identity: SsoIdentity) {
  try {
    return await createUser({
      email: identity.email,
      nama: identity.nama,
      nipNik: nipNikFrom(identity),
      // No password at all: this account signs in through SSO. Anyone who wants
      // a password as well can set one through "lupa sandi", which is exactly
      // the flow an invite-created account already uses.
      passwordHash: null,
      peran: 'Viewer',
      nomorHP: identity.nomorHP ?? undefined,
      // The IdP authenticated the address; a second verification email would be
      // asking someone to prove what has just been proved.
      emailVerifiedAt: new Date(),
      ssoSub: identity.sub,
      ssoSource: SSO_SOURCE,
    });
  } catch (error) {
    // Two first logins for the same new address can race on the unique email
    // index. The loser re-reads the row the winner just wrote.
    console.error('[sso] Gagal membuat akun dari SSO:', error);
    return getUserByEmail(identity.email);
  }
}

async function recordSsoFailure(
  identity: SsoIdentity,
  reason: string,
  meta: { userAgent: string | null; ipAddress: string | null }
) {
  await recordAudit({
    actor: { id: null, nama: identity.nama, email: identity.email, peran: '-' },
    aksi: 'auth.login',
    ringkasan: `Masuk lewat SSO ditolak untuk ${identity.email}`,
    hasil: 'gagal',
    galat: reason,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/** Back to the login page with a code the page can turn into a sentence. */
function failure(code: SsoErrorCode, logDetail: string) {
  console.error(`[sso] ${logDetail}`);
  const target = new URL('/sign-in', SITE_URL);
  target.searchParams.set('sso', code);

  const response = NextResponse.redirect(target);
  response.headers.append('set-cookie', clearedFlowCookie());
  return response;
}

function signedIn(next: string, setCookie: string) {
  // `next` is already forced to a same-origin absolute path by `safeNextPath`
  // before it is signed into the flow cookie, so it cannot escape this base.
  const response = NextResponse.redirect(new URL(next, SITE_URL));
  response.headers.append('set-cookie', setCookie);
  response.headers.append('set-cookie', clearedFlowCookie());
  return response;
}
