import { handleExpiredSessionResponse, sessionExpiredError } from './handleExpiredSessionClient';

export type AuthRole = 'tenant' | 'landlord' | 'maintenance_worker';

export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  primary_role: string;
  status: string;
};

type ApiResult<TData = undefined> = {
  ok: boolean;
  message?: string;
  user?: SessionUser | null;
  verificationRequired?: boolean;
  data?: TData;
};

const AUTH_REQUEST_TIMEOUT_MS = 20000;

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

async function parseResult<TData = undefined>(response: Response): Promise<ApiResult<TData>> {
  let body: ApiResult<TData> | null = null;

  try {
    body = (await response.json()) as ApiResult<TData>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (handleExpiredSessionResponse(response)) {
      throw sessionExpiredError();
    }
    const message = body?.message || 'Request failed.';
    throw new Error(message);
  }

  return body ?? { ok: true };
}

async function requestAuth<TData = undefined>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiResult<TData>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input, {
      credentials: 'same-origin',
      ...init,
      signal: controller.signal,
    });

    return await parseResult<TData>(response);
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new Error('Request timed out. Please try again.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function registerAccount(payload: {
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
  role: AuthRole;
}) {
  return requestAuth('/api/auth/account/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function verifyEmailCode(payload: { email: string; code: string }) {
  return requestAuth('/api/auth/verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function resendVerificationCode(payload: { email: string }) {
  return requestAuth('/api/auth/verification', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function login(payload: { email: string; password: string }) {
  return requestAuth('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function createSessionFromEmailLink(payload: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}) {
  return requestAuth('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function loadSession() {
  return requestAuth('/api/auth/session', {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function logout() {
  return requestAuth('/api/auth/session', {
    method: 'DELETE',
  });
}
