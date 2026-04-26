const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_REGEX = /^\d{6}$/;

export type ValidationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
    };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export async function parseJsonBody(request: Request): Promise<ValidationResult<Record<string, unknown>>> {
  try {
    const data = await request.json();

    if (!isObjectLike(data)) {
      return { ok: false, message: 'Request body must be a JSON object.' };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, message: 'Invalid JSON body.' };
  }
}

export function validateEmail(rawEmail: unknown): ValidationResult<string> {
  if (typeof rawEmail !== 'string') {
    return { ok: false, message: 'Email is required.' };
  }

  const email = normalizeEmail(rawEmail);
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, message: 'Email format is invalid.' };
  }

  return { ok: true, data: email };
}

export function validatePassword(rawPassword: unknown): ValidationResult<string> {
  if (typeof rawPassword !== 'string') {
    return { ok: false, message: 'Password is required.' };
  }

  if (rawPassword.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters.' };
  }

  return { ok: true, data: rawPassword };
}

export function validatePasswordConfirmation(
  password: string,
  rawConfirmPassword: unknown,
): ValidationResult<string> {
  if (typeof rawConfirmPassword !== 'string') {
    return { ok: false, message: 'Confirm password is required.' };
  }

  if (password !== rawConfirmPassword) {
    return { ok: false, message: 'Passwords do not match.' };
  }

  return { ok: true, data: rawConfirmPassword };
}

export function validateVerificationCode(rawCode: unknown): ValidationResult<string> {
  if (typeof rawCode !== 'string') {
    return { ok: false, message: 'Verification code is required.' };
  }

  const code = rawCode.trim();
  if (!VERIFICATION_CODE_REGEX.test(code)) {
    return { ok: false, message: 'Verification code format is invalid.' };
  }

  return { ok: true, data: code };
}

export function optionalName(rawName: unknown): string | undefined {
  if (typeof rawName !== 'string') {
    return undefined;
  }

  const trimmed = rawName.trim();
  return trimmed ? trimmed : undefined;
}
