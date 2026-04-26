import { NextResponse } from 'next/server';
import { activateUser, findAppUserByAuthUserId, provisionUserRecord } from 'lib/auth/userProvisioning';
import {
  checkVerificationEmailQuotaByEmail,
  recordVerificationEmailSentByUser,
} from 'lib/auth/emailSendLimiter';
import {
  optionalName,
  parseJsonBody,
  validateEmail,
  validateVerificationCode,
} from 'lib/auth/validation';
import { normalizeRegisterableRole } from 'lib/auth/roles';
import { setSessionCookies } from 'lib/auth/sessionCookies';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';

export async function POST(request: Request) {
  return verifySignupCode(request);
}

export async function PATCH(request: Request) {
  return resendSignupCode(request);
}

/**
 * Verifies the signup OTP code and activates the app user.
 */
async function verifySignupCode(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const { data } = bodyResult;
  const emailResult = validateEmail(data.email);
  if (emailResult.ok === false) {
    return NextResponse.json({ ok: false, message: emailResult.message }, { status: 400 });
  }

  const codeResult = validateVerificationCode(data.code ?? data.token);
  if (codeResult.ok === false) {
    return NextResponse.json({ ok: false, message: codeResult.message }, { status: 400 });
  }

  try {
    const authClient = getSupabaseAuthClient();
    const verifyResult = await authClient.auth.verifyOtp({
      email: emailResult.data,
      token: codeResult.data,
      type: 'signup',
    });

    if (verifyResult.error) {
      return NextResponse.json(
        {
          ok: false,
          message: verifyResult.error.message,
        },
        { status: 400 },
      );
    }

    const authUser = verifyResult.data.user ?? verifyResult.data.session?.user;
    if (!authUser) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Verification succeeded but no user profile was returned.',
        },
        { status: 500 },
      );
    }

    try {
      await activateUser(authUser.id);
    } catch {
      // If app user row is missing, rebuild it from auth metadata.
      const metadataRole = normalizeRegisterableRole(authUser.user_metadata?.role);
      if (!metadataRole) {
        return NextResponse.json(
          {
            ok: false,
            message: 'Email verified, but app role metadata is missing.',
          },
          { status: 500 },
        );
      }

      await provisionUserRecord({
        authUserId: authUser.id,
        email: authUser.email || emailResult.data,
        fullName: optionalName(authUser.user_metadata?.full_name),
        role: metadataRole,
        status: 'ACTIVE',
      });
    }

    const appUser = await findAppUserByAuthUserId(authUser.id);

    const response = NextResponse.json({
      ok: true,
      message: 'Email verified successfully.',
      user: appUser,
    });

    if (verifyResult.data.session) {
      setSessionCookies(response, verifyResult.data.session);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email verification failed.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/**
 * Resends a new signup OTP code to the same email address.
 */
async function resendSignupCode(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const emailResult = validateEmail(bodyResult.data.email);
  if (emailResult.ok === false) {
    return NextResponse.json({ ok: false, message: emailResult.message }, { status: 400 });
  }

  const { quota, user } = await checkVerificationEmailQuotaByEmail(emailResult.data);
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

  const authClient = getSupabaseAuthClient();
  const resendResult = await authClient.auth.resend({
    type: 'signup',
    email: emailResult.data,
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

  if (user) {
    await recordVerificationEmailSentByUser(user);
  }

  return NextResponse.json({
    ok: true,
    message: 'A new verification code has been sent.',
  });
}
