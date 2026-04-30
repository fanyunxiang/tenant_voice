import type { Session } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_EXPIRES_AT_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from './constants';

const baseCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function setSessionCookies(response: NextResponse, session: Session) {
  const expiresAtMs = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const maxAge = SESSION_MAX_AGE_SECONDS;

  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    ...baseCookieOptions,
    maxAge,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...baseCookieOptions,
    maxAge,
  });

  response.cookies.set(SESSION_EXPIRES_AT_COOKIE, String(expiresAtMs), {
    ...baseCookieOptions,
    maxAge,
  });
}

type SessionTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

export function setSessionTokenCookies(response: NextResponse, payload: SessionTokenPayload) {
  const maxAge = SESSION_MAX_AGE_SECONDS;
  const expiresAtMs = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;

  response.cookies.set(ACCESS_TOKEN_COOKIE, payload.accessToken, {
    ...baseCookieOptions,
    maxAge,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, payload.refreshToken, {
    ...baseCookieOptions,
    maxAge,
  });

  response.cookies.set(SESSION_EXPIRES_AT_COOKIE, String(expiresAtMs), {
    ...baseCookieOptions,
    maxAge,
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

  response.cookies.set(SESSION_EXPIRES_AT_COOKIE, '', {
    ...baseCookieOptions,
    maxAge: 0,
  });
}
