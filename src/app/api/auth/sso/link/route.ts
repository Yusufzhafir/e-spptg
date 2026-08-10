import { NextResponse, type NextRequest } from 'next/server';
import {
  SSO_PENDING_LINK_COOKIE_NAME,
  clearedPendingLinkCookie,
  getSsoConfig,
  readPendingLink,
} from '@/server/auth/sso';
import { SSO_SOURCE } from '@/lib/sso-config';
import { completeSsoSignIn, requestMeta } from '@/server/auth/sso-login';
import { getUserByEmail, linkSsoAccount } from '@/server/db/queries/user';
import { safeNextPath } from '@/lib/safe-next';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Confirms — or declines — linking an SSO identity to an existing account.
 *
 * Everything it acts on comes from the signed `SameSite=Lax` cookie set by
 * `/callbacksso`, never from the form body. The form only says which button was
 * pressed, so a forged post cannot name a different account to take over, and a
 * cross-site post does not carry the cookie at all.
 */
export async function POST(request: NextRequest) {
  const config = getSsoConfig();
  if (!config) return new NextResponse('Not found', { status: 404 });

  const pending = readPendingLink(
    request.cookies.get(SSO_PENDING_LINK_COOKIE_NAME)?.value,
    config
  );
  if (!pending) return done('/sign-in?sso=kadaluarsa');

  const form = await request.formData();
  if (form.get('aksi') !== 'hubungkan') {
    return done('/sign-in?sso=dibatalkan');
  }

  // Re-read by email rather than trusting anything carried across the redirect:
  // the account could have been deactivated or deleted while the page sat open.
  const user = await getUserByEmail(pending.email);
  if (!user) return done('/sign-in?sso=gagal');
  if (user.status !== 'Aktif') return done('/sign-in?sso=nonaktif');

  // Someone else finished linking this address first — do not overwrite their
  // `sso_sub`, and do not sign this identity in as them.
  if (user.ssoSub && user.ssoSub !== pending.sub) {
    return done('/sign-in?sso=gagal');
  }

  const linked = (await linkSsoAccount(user.id, pending.sub, SSO_SOURCE)) ?? user;
  const setCookie = await completeSsoSignIn(
    linked,
    requestMeta(request),
    `${linked.nama} menghubungkan akun dengan SSO Kutai Timur dan masuk`
  );

  return done(safeNextPath(pending.next), setCookie);
}

/** 303 so the browser turns the POST into a GET on the destination. */
function done(target: string, setCookie?: string) {
  const response = NextResponse.redirect(new URL(target, SITE_URL), 303);
  if (setCookie) response.headers.append('set-cookie', setCookie);
  response.headers.append('set-cookie', clearedPendingLinkCookie());
  return response;
}
