/**
 * The session cookie's name, kept in its own pure module because `proxy.ts`
 * runs on the Edge runtime and cannot pull in `src/server/auth/session.ts`
 * (which reaches for `server-only` and the Postgres driver).
 */
export const SESSION_COOKIE_NAME = 'espptg_session';
