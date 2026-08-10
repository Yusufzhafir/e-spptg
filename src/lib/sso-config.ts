/**
 * Configuration for SSO Kutai Timur (Keycloak, realm `kutimkab`).
 *
 * Kept free of server-only imports so the unit tests can exercise the rules that
 * actually decide who gets in — the on/off switch and the email allowlist —
 * without a network or a database.
 *
 * **SSO is additive, never a replacement.** With `SSO_ENABLED=true` the email +
 * password form keeps working exactly as before, for every account including
 * @gmail.com ones; the SSO button is an extra door for @kutaitimurkab.go.id
 * staff. With it false the button disappears and every SSO route answers 404, so
 * a half-configured realm cannot lock anybody out.
 */

/** Provider tag stored in `users.sso_source`, so a second IdP can be added later. */
export const SSO_SOURCE = 'sso_kutim';

export type SsoConfig = {
  /** e.g. https://sso.kutaitimurkab.go.id/auth/realms/kutimkab */
  issuer: string;
  clientId: string;
  /**
   * Empty for a public client (PKCE only, as in the Diskominfo manual); set for
   * a confidential client, which is what this app registers because it has a
   * server and can keep a secret. PKCE is sent either way — it costs nothing and
   * closes code interception even when a secret is in play.
   */
  clientSecret: string;
  /** Must match "Valid Redirect URIs" in the SSO dashboard character for character. */
  redirectUri: string;
  /**
   * Domains allowed to sign in through SSO, lowercase and without the "@".
   * Empty means every domain the IdP vouches for is accepted.
   */
  allowedEmailDomains: string[];
  /**
   * Passed through as the OIDC `prompt` parameter. Empty is the normal setting.
   * `login` forces Keycloak to ask for credentials even when it still has a live
   * session — the setting to use for a training day, where "keluar lalu masuk
   * lagi sebagai orang lain" must not silently reuse the previous session.
   */
  prompt: string;
};

function envFlag(raw: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((raw ?? '').trim().toLowerCase());
}

/** Split "a.go.id, b.go.id" into ['a.go.id', 'b.go.id']; blank yields []. */
export function parseEmailDomains(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

/**
 * The configuration, or null when SSO is off or incompletely configured.
 *
 * Incomplete counts as off **and says so in the log**: a missing client id with
 * `SSO_ENABLED=true` is a deployment mistake, and the failure people would
 * otherwise see is a button that redirects into a Keycloak error page.
 */
export function getSsoConfig(env: NodeJS.ProcessEnv = process.env): SsoConfig | null {
  if (!envFlag(env.SSO_ENABLED)) return null;

  const issuer = (env.SSO_ISSUER ?? '').trim().replace(/\/+$/, '');
  const clientId = (env.SSO_CLIENT_ID ?? '').trim();
  const redirectUri = (env.SSO_REDIRECT_URI ?? '').trim();

  if (!issuer || !clientId || !redirectUri) {
    console.error(
      '[sso] SSO_ENABLED=true tetapi SSO_ISSUER/SSO_CLIENT_ID/SSO_REDIRECT_URI belum lengkap — SSO dimatikan.'
    );
    return null;
  }

  return {
    issuer,
    clientId,
    clientSecret: (env.SSO_CLIENT_SECRET ?? '').trim(),
    redirectUri,
    // Default rather than empty: the whole point of this integration is staff
    // accounts on the county domain, and an empty allowlist would quietly accept
    // any address the realm happens to hold.
    allowedEmailDomains: parseEmailDomains(env.SSO_ALLOWED_EMAIL_DOMAINS ?? 'kutaitimurkab.go.id'),
    prompt: (env.SSO_PROMPT ?? '').trim(),
  };
}

export function isSsoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getSsoConfig(env) !== null;
}

/**
 * Whether an address vouched for by the IdP may sign in here.
 *
 * Subdomains are accepted (`dinas.kutaitimurkab.go.id` passes an allowlist of
 * `kutaitimurkab.go.id`) because county units get their own mail subdomains, but
 * only on a dot boundary — `notkutaitimurkab.go.id` must not slip through a
 * naive `endsWith`.
 */
export function isAllowedSsoEmail(email: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;

  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;

  return allowedDomains.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
  );
}

/** OIDC endpoints, derived from the issuer exactly as the Diskominfo manual lists them. */
export function ssoEndpoints(issuer: string) {
  return {
    discovery: `${issuer}/.well-known/openid-configuration`,
    authorization: `${issuer}/protocol/openid-connect/auth`,
    token: `${issuer}/protocol/openid-connect/token`,
    userinfo: `${issuer}/protocol/openid-connect/userinfo`,
    jwks: `${issuer}/protocol/openid-connect/certs`,
    logout: `${issuer}/protocol/openid-connect/logout`,
  };
}
