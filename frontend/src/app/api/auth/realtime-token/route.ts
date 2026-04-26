import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from 'lib/auth/constants';
import { setSessionCookies } from 'lib/auth/sessionCookies';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json({ ok: false, message: 'Not authenticated.' }, { status: 401 });
  }

  const authClient = getSupabaseAuthClient();
  const userResult = await authClient.auth.getUser(accessToken);

  if (!userResult.error && userResult.data.user) {
    return NextResponse.json({
      ok: true,
      data: {
        accessToken,
      },
    });
  }

  if (!refreshToken) {
    return NextResponse.json({ ok: false, message: 'Session is invalid.' }, { status: 401 });
  }

  const refreshResult = await authClient.auth.refreshSession({ refresh_token: refreshToken });
  if (refreshResult.error || !refreshResult.data.session) {
    return NextResponse.json({ ok: false, message: 'Session refresh failed.' }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    data: {
      accessToken: refreshResult.data.session.access_token,
    },
  });
  setSessionCookies(response, refreshResult.data.session);
  return response;
}
