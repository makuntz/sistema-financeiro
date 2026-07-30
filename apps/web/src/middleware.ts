import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/cadastro', '/convites'];
const PUBLIC_PREFIXES = [
  '/api/bff/auth/login',
  '/api/bff/auth/register',
  '/api/bff/invitations/preview',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (pathname.startsWith('/api/bff/auth/')) return true;
  if (pathname === '/') return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // For app routes, check if access cookie exists
  const hasAccessToken = request.cookies.has('pp_access_token');
  const hasRefreshToken = request.cookies.has('pp_refresh_token');

  if (!hasAccessToken && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
