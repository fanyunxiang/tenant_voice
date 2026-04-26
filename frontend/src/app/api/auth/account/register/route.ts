import { NextResponse } from 'next/server';
import { normalizeRegisterableRole } from 'lib/auth/roles';
import { provisionUserRecord } from 'lib/auth/userProvisioning';
import {
  optionalName,
  parseJsonBody,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from 'lib/auth/validation';
import { setSessionCookies } from 'lib/auth/sessionCookies';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

type AppUserStatusRow = {
  id: string;
  auth_user_id: string | null;
  status: string;
};

export async function POST(request: Request) {
  return registerAccount(request);
}

/**
 * Registers a new account and creates the matching app user profile.
 */
async function registerAccount(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const { data } = bodyResult;
  const emailResult = validateEmail(data.email);
  if (emailResult.ok === false) {
    return NextResponse.json({ ok: false, message: emailResult.message }, { status: 400 });
  }

  const passwordResult = validatePassword(data.password);
  if (passwordResult.ok === false) {
    return NextResponse.json({ ok: false, message: passwordResult.message }, { status: 400 });
  }

  const passwordConfirmationResult = validatePasswordConfirmation(
    passwordResult.data,
    data.confirmPassword,
  );
  if (passwordConfirmationResult.ok === false) {
    return NextResponse.json(
      { ok: false, message: passwordConfirmationResult.message },
      { status: 400 },
    );
  }

  const role = normalizeRegisterableRole(data.role);
  if (!role) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Role must be one of: tenant, landlord, maintenance_worker.',
      },
      { status: 400 },
    );
  }

  const fullName = optionalName(data.fullName);
  const email = emailResult.data;
  const password = passwordResult.data;

  const resetResult = await resetRetryStateForEmail(email);
  if (resetResult.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: resetResult.message,
      },
      { status: resetResult.status },
    );
  }

  const authClient = getSupabaseAuthClient();

  const signUpResult = await authClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: new URL('/auth/callback', request.url).toString(),
      data: {
        role,
        full_name: fullName,
      },
    },
  });

  if (signUpResult.error) {
    if (isAlreadyRegisteredError(signUpResult.error.message)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'This email is already registered. Please sign in or reset your password.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: signUpResult.error.message,
      },
      { status: 400 },
    );
  }

  const authUser = signUpResult.data.user;
  if (authUser) {
    const status = signUpResult.data.session ? 'ACTIVE' : 'PENDING_VERIFICATION';

    try {
      await provisionUserRecord({
        authUserId: authUser.id,
        email,
        fullName,
        role,
        status,
      });
    } catch (error) {
      await rollbackFailedProvision(authUser.id);

      const message = error instanceof Error ? error.message : 'Failed to provision user account.';
      return NextResponse.json({ ok: false, message }, { status: 500 });
    }
  }

  const response = NextResponse.json({
    ok: true,
    message: signUpResult.data.session
      ? 'Account created successfully.'
      : 'Registration submitted. Please check your email.',
    verificationRequired: !signUpResult.data.session,
  });

  if (signUpResult.data.session) {
    setSessionCookies(response, signUpResult.data.session);
  }

  return response;
}

function isAlreadyRegisteredError(message: string) {
  return /already registered|already been registered/i.test(message);
}

async function resetRetryStateForEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const supabase = getSupabaseServerClient();
  const userResult = await supabase
    .from('users')
    .select('id, auth_user_id, status')
    .eq('email', email)
    .maybeSingle();

  if (userResult.error) {
    return {
      ok: false,
      status: 500,
      message: `check existing app user failed: ${userResult.error.message}`,
    };
  }

  const appUser = (userResult.data as AppUserStatusRow | null) ?? null;
  if (appUser?.status === 'ACTIVE') {
    return {
      ok: false,
      status: 409,
      message: 'This email is already registered. Please sign in.',
    };
  }

  if (appUser) {
    const deleteAppUser = await supabase.from('users').delete().eq('id', appUser.id);
    if (deleteAppUser.error) {
      return {
        ok: false,
        status: 500,
        message: `clear failed app user failed: ${deleteAppUser.error.message}`,
      };
    }
  }

  const authUsersResult = await listAuthUsersByEmail(email);
  if (authUsersResult.ok === false) {
    return authUsersResult;
  }

  for (const authUser of authUsersResult.users) {
    if (authUser.email_confirmed_at) {
      return {
        ok: false,
        status: 409,
        message: 'This email is already registered. Please sign in.',
      };
    }

    const deleteResult = await deleteAuthUserById(authUser.id);
    if (deleteResult.ok === false) {
      return deleteResult;
    }
  }

  return { ok: true };
}

async function rollbackFailedProvision(authUserId: string) {
  const supabase = getSupabaseServerClient();

  const deleteAppUser = await supabase.from('users').delete().eq('auth_user_id', authUserId);
  if (deleteAppUser.error) {
    console.error('rollback app user delete failed:', deleteAppUser.error.message);
  }

  const deleteAuthUser = await deleteAuthUserById(authUserId);
  if (deleteAuthUser.ok === false) {
    console.error('rollback auth user delete failed:', deleteAuthUser.message);
  }
}

async function listAuthUsersByEmail(
  email: string,
): Promise<
  | { ok: true; users: Array<{ id: string; email: string | null; email_confirmed_at: string | null }> }
  | { ok: false; status: number; message: string }
> {
  const targetEmail = email.toLowerCase();
  const supabase = getSupabaseServerClient();
  const users: Array<{ id: string; email: string | null; email_confirmed_at: string | null }> = [];
  let page = 1;
  const perPage = 200;

  while (page <= 25) {
    const listResult = await supabase.auth.admin.listUsers({ page, perPage });
    if (listResult.error) {
      return {
        ok: false,
        status: 500,
        message: `list auth users failed: ${listResult.error.message}`,
      };
    }

    const currentUsers =
      listResult.data.users?.map((user) => ({
        id: user.id,
        email: user.email ?? null,
        email_confirmed_at: user.email_confirmed_at ?? null,
      })) ?? [];

    users.push(
      ...currentUsers.filter((user) => (user.email ?? '').toLowerCase() === targetEmail),
    );

    if (currentUsers.length < perPage) {
      break;
    }

    page += 1;
  }

  return { ok: true, users };
}

async function deleteAuthUserById(
  authUserId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const supabase = getSupabaseServerClient();
  const deleteResult = await supabase.auth.admin.deleteUser(authUserId);

  if (deleteResult.error) {
    const isNotFound = /not found/i.test(deleteResult.error.message);
    if (isNotFound) {
      return { ok: true };
    }

    return {
      ok: false,
      status: 500,
      message: `delete auth user failed: ${deleteResult.error.message}`,
    };
  }

  return { ok: true };
}
