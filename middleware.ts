import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/api/auth',
  '/api/auth/callback',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/session',
  '/api/auth/providers',
  '/api/auth/csrf',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/pwa',
  '/icons'
];

// Define admin routes that require ADMIN role
const adminRoutes = [
  '/admin',
  '/admin-portal'
];

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Allow public routes
    if (publicRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Check if user is trying to access admin routes
    if (adminRoutes.some(route => pathname.startsWith(route))) {
      // Redirect to login if not authenticated
      if (!token) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
      
      // Redirect to home if not admin
      if (token.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/', req.url));
      }
      
      return NextResponse.next();
    }

    // For all other routes (main app), require authentication
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Always allow public routes
        if (publicRoutes.some(route => pathname.startsWith(route))) {
          return true;
        }
        
        // For admin routes, check if user has admin role
        if (adminRoutes.some(route => pathname.startsWith(route))) {
          return !!token && token.role === 'ADMIN';
        }
        
        // For all other routes, just check if user is authenticated
        return !!token;
      },
    },
  }
);

// Configure which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (manifest.json, pwa files, etc.)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|pwa|icons).*)',
  ],
}; 