import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes (all routes under /app)
const isProtectedRoute = createRouteMatcher(['/app(.*)', '/api(.*)']);

// Define public routes
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Protect /app/* routes - require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Send already-signed-in visitors straight from "/" to the dashboard.
  // Doing this on the server means the landing page is never sent to the
  // browser, so it cannot flash before the client-side redirect kicks in.
  if (req.nextUrl.pathname === '/') {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL('/app', req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
