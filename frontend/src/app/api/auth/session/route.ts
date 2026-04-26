import { NextRequest, NextResponse } from 'next/server';
import { activateUser, findAppUserByAuthUserId, provisionUserRecord } from 'lib/auth/userProvisioning';
import { normalizeRegisterableRole } from 'lib/auth/roles';
import { ACCESS_TOKEN_COOKIE } from 'lib/auth/constants';
import { clearSessionCookies, setSessionCookies, setSessionTokenCookies } from 'lib/auth/sessionCookies';
import { optionalName, parseJsonBody, validateEmail, validatePassword } from 'lib/auth/validation';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';

export async function POST(request: Request) {
  return createSession(request);
}

export async function GET(request: NextRequest) {
  return getSession(request);
}

export async function DELETE() {
  return deleteSession();
}

/**
 * Creates a session with email and password.
 */
async function createSession(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const { data } = bodyResult;
  const tokenSessionResult = await tryCreateSessionFromEmailLink(data);
  if (tokenSessionResult) {
    return tokenSessionResult;
  }

  const emailResult = validateEmail(data.email);
  if (emailResult.ok === false) {
    return NextResponse.json({ ok: false, message: emailResult.message }, { status: 400 });
  }

  const passwordResult = validatePassword(data.password);
  if (passwordResult.ok === false) {
    return NextResponse.json({ ok: false, message: passwordResult.message }, { status: 400 });
  }

  try {
    const authClient = getSupabaseAuthClient();
    const signInResult = await authClient.auth.signInWithPassword({
      email: emailResult.data,
      password: passwordResult.data,
    });

    if (signInResult.error || !signInResult.data.session) {
      return NextResponse.json(
        {
          ok: false,
          message: signInResult.error?.message || 'Invalid login credentials.',
        },
        { status: 401 },
      );
    }

    const authUser = signInResult.data.session.user;
    if (!authUser.email_confirmed_at) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Please verify your email before signing in.',
        },
        { status: 403 },
      );
    }

    let appUser = await findAppUserByAuthUserId(authUser.id);

    if (!appUser) {
      const metadataRole = normalizeRegisterableRole(authUser.user_metadata?.role) ?? 'tenant';
      appUser = await provisionUserRecord({
        authUserId: authUser.id,
        email: authUser.email || emailResult.data,
        fullName: optionalName(authUser.user_metadata?.full_name),
        role: metadataRole,
        status: 'ACTIVE',
      });
    } else if (appUser.status !== 'ACTIVE') {
      await activateUser(authUser.id);
      appUser = await findAppUserByAuthUserId(authUser.id);
    }

    const response = NextResponse.json({
      ok: true,
      message: 'Login successful.',
      user: appUser,
    });
    setSessionCookies(response, signInResult.data.session);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/**
 * Creates a session from Supabase email-link hash tokens.
 */
async function tryCreateSessionFromEmailLink(data: Record<string, unknown>) {
  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : null;
  const refreshToken = typeof data.refreshToken === 'string' ? data.refreshToken : null;
  const expiresIn = typeof data.expiresIn === 'number' ? data.expiresIn : 3600;

  if (!accessToken || !refreshToken) {
    return null;
  }

  try {
    const authClient = getSupabaseAuthClient();
    const userResult = await authClient.auth.getUser(accessToken);
    if (userResult.error || !userResult.data.user) {
      return NextResponse.json({ ok: false, message: 'Session token is invalid.' }, { status: 401 });
    }

    const authUser = userResult.data.user;
    if (!authUser.email_confirmed_at) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Please verify your email before continuing.',
        },
        { status: 403 },
      );
    }

    let appUser = await findAppUserByAuthUserId(authUser.id);
    if (!appUser) {
      if (!authUser.email) {
        return NextResponse.json(
          { ok: false, message: 'Verified user does not have an email address.' },
          { status: 500 },
        );
      }

      const metadataRole = normalizeRegisterableRole(authUser.user_metadata?.role) ?? 'tenant';
      appUser = await provisionUserRecord({
        authUserId: authUser.id,
        email: authUser.email,
        fullName: optionalName(authUser.user_metadata?.full_name),
        role: metadataRole,
        status: 'ACTIVE',
      });
    } else if (appUser.status !== 'ACTIVE') {
      await activateUser(authUser.id);
      appUser = await findAppUserByAuthUserId(authUser.id);
    }

    const response = NextResponse.json({
      ok: true,
      message: 'Email verified and session created.',
      user: appUser,
    });

    setSessionTokenCookies(response, {
      accessToken,
      refreshToken,
      expiresIn,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete email confirmation.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/**
 * Returns the currently authenticated user from the session cookie.
 */
async function getSession(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const authClient = getSupabaseAuthClient();
    const userResult = await authClient.auth.getUser(accessToken);
    if (userResult.error || !userResult.data.user) {
      return NextResponse.json({ ok: false, message: 'Session is invalid.' }, { status: 401 });
    }

    const appUser = await findAppUserByAuthUserId(userResult.data.user.id);
    if (!appUser) {
      return NextResponse.json(
        { ok: false, message: 'Authenticated user is not provisioned in app database.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: appUser,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load current user.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/**
 * Logs out by clearing auth cookies from the browser.
 */
async function deleteSession() {
  const response = NextResponse.json({
    ok: true,
    message: 'Logged out successfully.',
  });

  clearSessionCookies(response);
  return response;
}
