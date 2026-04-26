import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, APP_DEFAULT_PATH } from './src/lib/auth/constants';

const SIGN_IN_PATH = '/auth/sign-in';

const PUBLIC_PAGE_PATHS = new Set([
  '/',
  '/admin/listings',
  '/auth',
  '/auth/sign-in',
  '/auth/register',
  '/auth/sign-up',
  '/auth/callback',
  '/auth/verified',
]);

function hasAccessToken(request: NextRequest) {
  return Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
}

function isPublicPage(pathname: string) {
  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    return true;
  }

  if (pathname.startsWith('/auth/')) {
    return true;
  }

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = hasAccessToken(request);

  const isAuthPath = pathname.startsWith('/auth');
  const isAuthCallbackPath = pathname === '/auth/callback';
  const isAuthVerifiedPath = pathname === '/auth/verified';
  const isAllowedAuthPathWhenSignedIn = isAuthCallbackPath || isAuthVerifiedPath;

  if (!isAuthenticated && !isPublicPage(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = SIGN_IN_PATH;
    redirectUrl.search = '';
    if (pathname !== SIGN_IN_PATH) {
      redirectUrl.searchParams.set('next', `${pathname}${search}`);
    }

    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthenticated && isAuthPath && !isAllowedAuthPathWhenSignedIn) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = APP_DEFAULT_PATH;
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/auth/:path*', '/rtl/:path*'],
};
