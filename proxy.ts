import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const SIGN_IN_URL = '/sign-in'

// Only the watchlist needs an account. The Valuator (/explore, /stock/*) and
// the Screener (/screener) stay fully public.
const isProtectedRoute = createRouteMatcher(['/watchlist(.*)'])

export default clerkMiddleware(
  async (auth, req) => {
    if (!isProtectedRoute(req)) return

    const { userId } = await auth()
    if (userId) return

    // Redirect explicitly instead of `auth.protect()`: protect() rewrites
    // non-document requests (client-side navigations, prefetches) to a 404,
    // which is what signed-out visitors were seeing on /watchlist.
    const signInUrl = new URL(SIGN_IN_URL, req.url)
    signInUrl.searchParams.set(
      'redirect_url',
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
    )
    return NextResponse.redirect(signInUrl)
  },
  { signInUrl: SIGN_IN_URL, signUpUrl: '/sign-up' },
)

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
