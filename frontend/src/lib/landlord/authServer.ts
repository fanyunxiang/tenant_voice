import { NextRequest, NextResponse } from 'next/server';
import { findAppUserByAuthUserId } from 'lib/auth/userProvisioning';
import { ACCESS_TOKEN_COOKIE } from 'lib/auth/constants';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';

export type AuthenticatedAppUser = {
  id: string;
  email: string;
  fullName: string | null;
  primaryRole: string;
};

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
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: 'Not authenticated.' }, { status: 401 }),
    };
  }

  const authClient = getSupabaseAuthClient();
  const authUserResult = await authClient.auth.getUser(accessToken);
  if (authUserResult.error || !authUserResult.data.user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: 'Session is invalid.' }, { status: 401 }),
    };
  }

  const appUser = await findAppUserByAuthUserId(authUserResult.data.user.id);
  if (!appUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Authenticated user is not provisioned.' },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true,
    data: {
      id: appUser.id,
      email: appUser.email,
      fullName: appUser.full_name,
      primaryRole: appUser.primary_role,
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
