import { NextRequest, NextResponse } from 'next/server';
import { findAppUserByAuthUserId } from 'lib/auth/userProvisioning';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from 'lib/auth/constants';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';
import { buildExpiredSessionResponse, getRequestSessionExpiryValue, isSessionWindowExpired } from 'lib/auth/authErrors';

export type AuthenticatedAppUser = {
  id: string;
  email: string;
  fullName: string | null;
  primaryRole: string;
};

export async function resolveOptionalAppUser(
  request: NextRequest,
): Promise<AuthenticatedAppUser | null> {
  const expiresAt = getRequestSessionExpiryValue(request);
  if (isSessionWindowExpired(expiresAt)) {
    return null;
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!accessToken && !refreshToken) {
    return null;
  }

  const authClient = getSupabaseAuthClient();
  let authUserId: string | null = null;

  if (accessToken) {
    const authUserResult = await authClient.auth.getUser(accessToken);
    if (!authUserResult.error && authUserResult.data.user) {
      authUserId = authUserResult.data.user.id;
    }
  }

  if (!authUserId && refreshToken) {
    const refreshResult = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (!refreshResult.error && refreshResult.data.session?.user) {
      authUserId = refreshResult.data.session.user.id;
    }
  }

  if (!authUserId) {
    return null;
  }

  const appUser = await findAppUserByAuthUserId(authUserId);
  if (!appUser) {
    return null;
  }

  return {
    id: appUser.id,
    email: appUser.email,
    fullName: appUser.full_name,
    primaryRole: appUser.primary_role,
  };
}

export async function resolveAuthenticatedAppUser(
  request: NextRequest,
): Promise<
  | {
      ok: true;
      data: AuthenticatedAppUser;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const expiresAt = getRequestSessionExpiryValue(request);
  if (isSessionWindowExpired(expiresAt)) {
    return {
      ok: false,
      response: buildExpiredSessionResponse(),
    };
  }

  const appUser = await resolveOptionalAppUser(request);
  if (!appUser) {
    return {
      ok: false,
      response: buildExpiredSessionResponse(),
    };
  }

  return {
    ok: true,
    data: {
      id: appUser.id,
      email: appUser.email,
      fullName: appUser.fullName,
      primaryRole: appUser.primaryRole,
    },
  };
}

export async function resolveAuthenticatedLandlord(
  request: NextRequest,
): Promise<
  | {
      ok: true;
      data: AuthenticatedAppUser;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const authResult = await resolveAuthenticatedAppUser(request);
  if (authResult.ok === false) {
    return authResult;
  }

  if (authResult.data.primaryRole !== 'LANDLORD') {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'This API is only available for landlord accounts.' },
        { status: 403 },
      ),
    };
  }

  return authResult;
}
