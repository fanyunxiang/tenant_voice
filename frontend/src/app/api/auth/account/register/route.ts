import { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  checkVerificationEmailQuotaByUser,
  recordVerificationEmailSentByUser,
} from 'lib/auth/emailSendLimiter';
import { normalizeRegisterableRole } from 'lib/auth/roles';
import { setSessionCookies } from 'lib/auth/sessionCookies';
import { provisionUserRecord } from 'lib/auth/userProvisioning';
import {
  optionalName,
  parseJsonBody,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from 'lib/auth/validation';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

export async function POST(request: Request) {
  return registerAccount(request);
}

/**
 * Registers a new account and creates the matching app user profile.
 * If the email is pending verification, this endpoint resends verification email
 * under the per-user limiter instead of deleting and recreating auth records.
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
  const authClient = getSupabaseAuthClient();

  const existingAuthUsersResult = await listAuthUsersByEmail(email);
  if (existingAuthUsersResult.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message: existingAuthUsersResult.message,
      },
      { status: existingAuthUsersResult.status },
    );
  }

  const confirmedAuthUser = existingAuthUsersResult.users.find((user) => user.email_confirmed_at);
  if (confirmedAuthUser) {
    return NextResponse.json(
      {
        ok: false,
        message: 'This email is already registered. Please sign in.',
      },
      { status: 409 },
    );
  }

  const pendingAuthUser = existingAuthUsersResult.users[0];
  if (pendingAuthUser) {
    const quota = await checkVerificationEmailQuotaByUser(pendingAuthUser);
    if (quota.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          message: quota.message,
          retryAfterSeconds: quota.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const resendResult = await authClient.auth.resend({
      type: 'signup',
      email,
    });

    if (resendResult.error) {
      return NextResponse.json(
        {
          ok: false,
          message: resendResult.error.message,
        },
        { status: 400 },
      );
    }

    await recordVerificationEmailSentByUser(pendingAuthUser);

    return NextResponse.json({
      ok: true,
      message: 'Verification email sent. Please check your inbox.',
      verificationRequired: true,
    });
  }

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

  if (authUser && !signUpResult.data.session) {
    // The initial signup send counts toward the per-user email quota.
    try {
      await recordVerificationEmailSentByUser(authUser);
    } catch (error) {
      console.error(
        'record initial verification email limiter state failed:',
        error instanceof Error ? error.message : String(error),
      );
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
  | {
      ok: true;
      users: User[];
    }
  | { ok: false; status: number; message: string }
> {
  const targetEmail = email.toLowerCase();
  const supabase = getSupabaseServerClient();
  const users: User[] = [];
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

    const currentUsers = listResult.data.users ?? [];
    users.push(...currentUsers.filter((user) => (user.email ?? '').toLowerCase() === targetEmail));

    if (currentUsers.length < perPage) {
      break;
    }

    page += 1;
  }

  users.sort((a, b) => {
    const aTs = new Date(a.created_at ?? 0).getTime();
    const bTs = new Date(b.created_at ?? 0).getTime();
    return bTs - aTs;
  });

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
