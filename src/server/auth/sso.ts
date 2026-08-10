import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isAllowedSsoEmail, ssoEndpoints, type SsoConfig } from '@/lib/sso-config';

/**
 * OpenID Connect client for SSO Kutai Timur, written against the Diskominfo
 * manual (Authorization Code + PKCE, realm `kutimkab`).
 *
 * **Why no `openid-client` dependency.** The manual's sample uses it, but the
 * only things this app needs are three HTTPS calls and a SHA-256 — and the one
 * job a library really earns its keep for, verifying an ID token signature
 * against JWKS, is not needed here: the tokens arrive as the response body of
 * *our own* TLS call to the token endpoint, never from a browser or a third
 * party. OIDC Core §3.1.3.7 says signature validation MAY be skipped in exactly
 * that case, and the identity we act on is then read back from `userinfo` over
 * TLS as well. Nothing in this flow ever trusts a token somebody handed us.
 *
 * If this app later exposes an API that accepts SSO bearer tokens from other
 * systems, that is a different situation and *does* need JWKS validation — see
 * section 5 of the manual. Do not reuse this module for it.
 */

const FLOW_COOKIE = 'espptg_sso_flow';
const PENDING_LINK_COOKIE = 'espptg_sso_link';

/** Both handshake cookies are short-lived: a login that stalls this long is dead. */
const FLOW_TTL_SECONDS = 10 * 60;

const FETCH_TIMEOUT_MS = 10_000;

export { getSsoConfig, isSsoEnabled } from '@/lib/sso-config';

// ---------------------------------------------------------------------------
// Cookie signing
// ---------------------------------------------------------------------------

/**
 * Key for the HMAC on both handshake cookies.
 *
 * The signature is what stops **login CSRF**: without it, anyone able to plant a
 * cookie in someone's browser could plant their own `state` and `code_verifier`
 * and finish the handshake as themselves in the victim's session — and for the
 * pending-link cookie they could simply rewrite which email is about to be
 * linked, which is an account takeover.
 *
 * A per-process random fallback keeps a public client (no secret to borrow)
 * working; the only cost is that logins mid-handshake break across a restart,
 * inside a 10-minute window.
 */
const processKey = randomBytes(32).toString('base64url');

function signingKey(config: SsoConfig): string {
  return config.clientSecret || process.env.SSO_STATE_SECRET?.trim() || processKey;
}

function sign(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('base64url');
}

function verify(value: string, signature: string, key: string): boolean {
  const expected = Buffer.from(sign(value, key));
  const given = Buffer.from(signature);
  // Length must match before `timingSafeEqual`, which throws on a mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function encodeCookie(payload: unknown, key: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, key)}`;
}

function decodeCookie<T>(raw: string | undefined, key: string): T | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot === -1) return null;

  const body = raw.slice(0, dot);
  if (!verify(body, raw.slice(dot + 1), key)) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

function cookieAttributes(maxAgeSeconds: number): string {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs.join('; ');
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

/** RFC 7636 S256: BASE64URL(SHA256(ASCII(verifier))), no padding. */
export function codeChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export type SsoFlowState = {
  state: string;
  nonce: string;
  verifier: string;
  /** Where to land after a successful login; always a same-origin absolute path. */
  next: string;
};

export function createFlowState(next: string): SsoFlowState {
  return {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(16).toString('base64url'),
    // 43–128 chars per RFC 7636; 32 random bytes base64url is 43.
    verifier: randomBytes(32).toString('base64url'),
    next,
  };
}

export function flowCookie(state: SsoFlowState, config: SsoConfig): string {
  return `${FLOW_COOKIE}=${encodeCookie(state, signingKey(config))}; ${cookieAttributes(FLOW_TTL_SECONDS)}`;
}

export function clearedFlowCookie(): string {
  return `${FLOW_COOKIE}=; ${cookieAttributes(0)}`;
}

export function readFlowState(
  cookieValue: string | undefined,
  config: SsoConfig
): SsoFlowState | null {
  return decodeCookie<SsoFlowState>(cookieValue, signingKey(config));
}

export const SSO_FLOW_COOKIE_NAME = FLOW_COOKIE;
export const SSO_PENDING_LINK_COOKIE_NAME = PENDING_LINK_COOKIE;

// ---------------------------------------------------------------------------
// Pending account link
// ---------------------------------------------------------------------------

/**
 * Set when SSO vouches for an email that already has a local account which has
 * never been linked. The manual asks for an explicit confirmation step here
 * rather than silent linking.
 */
export type PendingSsoLink = {
  sub: string;
  email: string;
  nama: string;
  next: string;
};

export function pendingLinkCookie(link: PendingSsoLink, config: SsoConfig): string {
  return `${PENDING_LINK_COOKIE}=${encodeCookie(link, signingKey(config))}; ${cookieAttributes(FLOW_TTL_SECONDS)}`;
}

export function clearedPendingLinkCookie(): string {
  return `${PENDING_LINK_COOKIE}=; ${cookieAttributes(0)}`;
}

export function readPendingLink(
  cookieValue: string | undefined,
  config: SsoConfig
): PendingSsoLink | null {
  return decodeCookie<PendingSsoLink>(cookieValue, signingKey(config));
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

type Endpoints = ReturnType<typeof ssoEndpoints>;

let cachedEndpoints: { issuer: string; endpoints: Endpoints } | null = null;

/**
 * Endpoints from the realm's discovery document, falling back to the paths the
 * manual spells out.
 *
 * Discovery is preferred because it survives a realm moving off the legacy
 * `/auth` prefix; the fallback is there because a login must not fail just
 * because one extra request timed out.
 */
export async function resolveEndpoints(config: SsoConfig): Promise<Endpoints> {
  if (cachedEndpoints?.issuer === config.issuer) return cachedEndpoints.endpoints;

  const derived = ssoEndpoints(config.issuer);
  try {
    const response = await fetch(derived.discovery, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.ok) {
      const doc = (await response.json()) as Record<string, string>;
      const endpoints: Endpoints = {
        discovery: derived.discovery,
        authorization: doc.authorization_endpoint || derived.authorization,
        token: doc.token_endpoint || derived.token,
        userinfo: doc.userinfo_endpoint || derived.userinfo,
        jwks: doc.jwks_uri || derived.jwks,
        logout: doc.end_session_endpoint || derived.logout,
      };
      cachedEndpoints = { issuer: config.issuer, endpoints };
      return endpoints;
    }
    console.error(`[sso] Discovery menjawab ${response.status}; memakai endpoint bawaan manual.`);
  } catch (error) {
    console.error('[sso] Discovery gagal; memakai endpoint bawaan manual:', error);
  }

  return derived;
}

// ---------------------------------------------------------------------------
// Authorization request
// ---------------------------------------------------------------------------

export async function authorizationUrl(
  config: SsoConfig,
  state: SsoFlowState
): Promise<string> {
  const endpoints = await resolveEndpoints(config);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state: state.state,
    nonce: state.nonce,
    code_challenge: codeChallengeS256(state.verifier),
    code_challenge_method: 'S256',
  });
  if (config.prompt) params.set('prompt', config.prompt);

  return `${endpoints.authorization}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange + userinfo
// ---------------------------------------------------------------------------

export class SsoError extends Error {}

async function exchangeCode(
  config: SsoConfig,
  code: string,
  verifier: string
): Promise<string> {
  const endpoints = await resolveEndpoints(config);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
  });
  // Public clients must not send a secret and confidential clients must — the
  // manual lists mixing these up as the cause of `invalid_client`.
  if (config.clientSecret) body.set('client_secret', config.clientSecret);

  const response = await fetch(endpoints.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    // The body carries Keycloak's `error`/`error_description`, which is the
    // difference between a five-minute fix and an afternoon of guessing.
    const detail = await response.text().catch(() => '');
    throw new SsoError(`Token endpoint ${response.status}: ${detail.slice(0, 500)}`);
  }

  const tokens = (await response.json()) as { access_token?: string };
  if (!tokens.access_token) throw new SsoError('Token endpoint tidak mengembalikan access_token.');
  return tokens.access_token;
}

/** The claims the manual documents, after normalisation. */
export type SsoIdentity = {
  sub: string;
  email: string;
  nama: string;
  nip: string | null;
  nik: string | null;
  userType: string | null;
  nomorHP: string | null;
  approvalStatus: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Turn a raw `userinfo` payload into the identity this app stores, or throw with
 * a message that is safe to show the person on screen.
 */
export function normalizeIdentity(raw: Record<string, unknown>): SsoIdentity {
  const sub = asString(raw.sub);
  const email = asString(raw.email);

  if (!sub || !email) {
    throw new SsoError('Data SSO tidak lengkap: sub atau email kosong.');
  }

  return {
    sub,
    email: email.toLowerCase(),
    // `name` is firstName + lastName per the manual; fall back to the local part
    // of the address rather than storing an empty nama, which is NOT NULL here.
    nama: asString(raw.name) ?? email.slice(0, email.indexOf('@')),
    nip: asString(raw.nip),
    nik: asString(raw.nik),
    userType: asString(raw.user_type),
    nomorHP: asString(raw.phone_number),
    approvalStatus: asString(raw.approval_status),
  };
}

export async function fetchIdentity(
  config: SsoConfig,
  code: string,
  verifier: string
): Promise<SsoIdentity> {
  const accessToken = await exchangeCode(config, code, verifier);
  const endpoints = await resolveEndpoints(config);

  const response = await fetch(endpoints.userinfo, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new SsoError(`UserInfo endpoint ${response.status}`);
  }

  return normalizeIdentity((await response.json()) as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Admission rules
// ---------------------------------------------------------------------------

/**
 * Reasons an identity the IdP happily authenticated is still refused here.
 * Returns null when the person may proceed.
 */
export function refusalReason(identity: SsoIdentity, config: SsoConfig): string | null {
  if (identity.approvalStatus && identity.approvalStatus !== 'approved') {
    return 'Akun SSO Anda belum disetujui. Hubungi admin SSO Kutai Timur.';
  }

  if (!isAllowedSsoEmail(identity.email, config.allowedEmailDomains)) {
    const domains = config.allowedEmailDomains.map((d) => `@${d}`).join(', ');
    return `Masuk lewat SSO hanya untuk akun ${domains}. Gunakan email dan kata sandi untuk akun lain.`;
  }

  return null;
}

/**
 * `users.nip_nik` is NOT NULL, but SSO only sends `nip` for ASN and `nik` for
 * warga — and may send neither. A dash keeps the column honest ("belum diisi")
 * instead of inventing a number, and an admin can fill it in from Pengaturan.
 */
export function nipNikFrom(identity: SsoIdentity): string {
  return (identity.nip ?? identity.nik ?? '-').slice(0, 20);
}
