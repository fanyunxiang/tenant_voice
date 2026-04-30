import { handleExpiredSessionResponse, sessionExpiredError } from 'lib/auth/handleExpiredSessionClient';

type LandlordApiResult<TData = unknown> = {
  ok: boolean;
  message?: string;
  data?: TData;
};

const REQUEST_TIMEOUT_MS = 20000;

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

async function parseResponse<TData>(response: Response): Promise<LandlordApiResult<TData>> {
  let body: LandlordApiResult<TData> | null = null;

  try {
    body = (await response.json()) as LandlordApiResult<TData>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (handleExpiredSessionResponse(response)) {
      throw sessionExpiredError();
    }
    throw new Error(body?.message || 'Request failed.');
  }

  return body ?? { ok: true };
}

export async function requestLandlord<TData = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<LandlordApiResult<TData>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input, {
      credentials: 'same-origin',
      ...init,
      signal: controller.signal,
    });

    return await parseResponse<TData>(response);
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new Error('Request timed out. Please try again.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type { LandlordApiResult };
