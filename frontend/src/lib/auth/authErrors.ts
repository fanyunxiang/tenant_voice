import { NextResponse } from 'next/server';
import {
  AUTH_TOKEN_EXPIRED_CODE,
  AUTH_TOKEN_EXPIRED_MESSAGE,
  AUTH_TOKEN_EXPIRED_STATUS,
  SESSION_EXPIRES_AT_COOKIE,
} from './constants';

export function buildExpiredSessionResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: AUTH_TOKEN_EXPIRED_CODE,
      message: AUTH_TOKEN_EXPIRED_MESSAGE,
    },
    { status: AUTH_TOKEN_EXPIRED_STATUS },
  );
}

export function isSessionWindowExpired(expiresAtRaw: string | undefined, nowMs = Date.now()) {
  if (!expiresAtRaw) {
    return false;
  }

  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return nowMs >= expiresAtMs;
}

export function getRequestSessionExpiryValue(request: { cookies: { get: (name: string) => { value?: string } | undefined } }) {
  return request.cookies.get(SESSION_EXPIRES_AT_COOKIE)?.value;
}
