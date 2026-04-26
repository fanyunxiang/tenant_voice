import type { Session } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './constants';

const baseCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function setSessionCookies(response: NextResponse, session: Session) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    ...baseCookieOptions,
    maxAge: Math.max(session.expires_in, 60),
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

type SessionTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

export function setSessionTokenCookies(response: NextResponse, payload: SessionTokenPayload) {
  const maxAge = Math.max(payload.expiresIn ?? 3600, 60);

  response.cookies.set(ACCESS_TOKEN_COOKIE, payload.accessToken, {
    ...baseCookieOptions,
    maxAge,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, payload.refreshToken, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    ...baseCookieOptions,
    maxAge: 0,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    ...baseCookieOptions,
    maxAge: 0,
  });
}
