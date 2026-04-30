import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from 'lib/auth/constants';
import { buildExpiredSessionResponse, getRequestSessionExpiryValue, isSessionWindowExpired } from 'lib/auth/authErrors';

export async function GET(request: NextRequest) {
  const expiresAt = getRequestSessionExpiryValue(request);
  if (isSessionWindowExpired(expiresAt)) {
    return buildExpiredSessionResponse();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return buildExpiredSessionResponse();
  }

  const authClient = getSupabaseAuthClient();
  if (accessToken) {
    const userResult = await authClient.auth.getUser(accessToken);
    if (!userResult.error && userResult.data.user) {
      return NextResponse.json({
        ok: true,
        data: {
          accessToken,
        },
      });
    }
  }

  if (!refreshToken) {
    return buildExpiredSessionResponse();
  }

  const refreshResult = await authClient.auth.refreshSession({ refresh_token: refreshToken });
  if (refreshResult.error || !refreshResult.data.session) {
    return buildExpiredSessionResponse();
  }

  return NextResponse.json({
    ok: true,
    data: {
      accessToken: refreshResult.data.session.access_token,
    },
  });
}
