import { NextResponse, type NextRequest } from 'next/server';
import { authorizationUrl, createFlowState, flowCookie, getSsoConfig } from '@/server/auth/sso';
import { safeNextPath } from '@/lib/safe-next';

export const runtime = 'nodejs';
// The authorize URL carries a fresh state and PKCE challenge every time; caching
// this response would hand the same handshake to two different people.
export const dynamic = 'force-dynamic';

/**
 * Step 1 of the SSO handshake: mint state + PKCE, remember them in a signed
 * HttpOnly cookie, and send the browser to Keycloak's login page.
 *
 * A plain `GET` that redirects, so the button on the sign-in page can be an
 * ordinary link that works without JavaScript.
 */
export async function GET(request: NextRequest) {
  const config = getSsoConfig();
  // 404 rather than a friendly error: with SSO off this route does not exist as
  // far as the outside world is concerned.
  if (!config) return new NextResponse('Not found', { status: 404 });

  const state = createFlowState(safeNextPath(request.nextUrl.searchParams.get('next')));
  const response = NextResponse.redirect(await authorizationUrl(config, state));
  response.headers.append('set-cookie', flowCookie(state, config));
  return response;
}
