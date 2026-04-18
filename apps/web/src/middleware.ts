import { NextResponse, type NextRequest } from 'next/server'

// NOTE: Authentication is enforced client-side by AdminLayoutClient /
// PortalLayoutClient via the backend /api/auth/me endpoint. We intentionally
// do NOT gate routes here on a `token` cookie, because that cookie is set by
// the backend on the API origin (e.g. api.propgroup.com) and is not present
// on the Next.js origin — any cookie-based middleware guard would always
// fail and kick authenticated users back to /auth/login.
export async function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled by backend)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}