import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, APP_DEFAULT_PATH, AUTH_REGISTER_PATH } from './src/lib/auth/constants';

function hasAccessToken(request: NextRequest) {
  return Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = hasAccessToken(request);

  const isRootPath = pathname === '/';
  const isAdminPath = pathname.startsWith('/admin');
  const isRtlPath = pathname.startsWith('/rtl');
  const isAuthPath = pathname.startsWith('/auth');
  const isAuthCallbackPath = pathname === '/auth/callback';
  const isAuthVerifiedPath = pathname === '/auth/verified';
  const isAllowedAuthPathWhenSignedIn = isAuthCallbackPath || isAuthVerifiedPath;

  if (!isAuthenticated && (isRootPath || isAdminPath || isRtlPath)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = AUTH_REGISTER_PATH;
    redirectUrl.search = '';

    if ((isAdminPath || isRtlPath) && pathname !== AUTH_REGISTER_PATH) {
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
