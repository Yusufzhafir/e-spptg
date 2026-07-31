import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';

/**
 * Edge-runtime gate for the app shell. It can only see *whether* a session
 * cookie is present — validating it needs the database, which is not reachable
 * from here — so this is a cheap first pass, not the authorization boundary.
 *
 * The real checks are the tRPC procedures (`protectedProcedure` and the role
 * middlewares in `src/trpc/init.ts`), which resolve the cookie against the
 * `sessions` table on every call. A forged or stale cookie gets past this file
 * and then fails there, which is why the app shell signs the user out when its
 * first query comes back unauthenticated.
 *
 * `/api/trpc` is deliberately *not* gated: login, registration and the password
 * reset flow are tRPC procedures that anonymous callers must be able to reach.
 */
const APP_PREFIX = '/app';

export default function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);
  const { pathname, search } = req.nextUrl;

  if (pathname === APP_PREFIX || pathname.startsWith(`${APP_PREFIX}/`)) {
    if (!hasSession) {
      const signIn = new URL('/sign-in', req.url);
      // Remember where they were headed so login can send them back there.
      signIn.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  }

  // Send signed-in visitors straight from "/" to the dashboard. Doing it on the
  // server means the landing page is never sent to the browser, so it cannot
  // flash before a client-side redirect kicks in.
  if (pathname === '/' && hasSession) {
    return NextResponse.redirect(new URL('/app', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
