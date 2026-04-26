import { getSupabaseBrowserClient } from 'lib/supabase/browserClient';
import { TenantProfileData, TenantProfileDocumentType } from './profile';

type TenantProfileApiResponse<TData = unknown> = {
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

async function parseResponse<TData>(response: Response): Promise<TenantProfileApiResponse<TData>> {
  let body: TenantProfileApiResponse<TData> | null = null;

  try {
    body = (await response.json()) as TenantProfileApiResponse<TData>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.message || 'Request failed.');
  }

  return body ?? { ok: true };
}

async function requestProfile(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<TenantProfileApiResponse>;
async function requestProfile<TData>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<TenantProfileApiResponse<TData>>;
async function requestProfile<TData = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<TenantProfileApiResponse<TData>> {
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

export async function loadTenantProfile() {
  return requestProfile<TenantProfileData>('/api/tenant/profile', {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function updateTenantProfile(payload: {
  fullName?: string | null;
  phone?: string | null;
  preferredAreas?: string[];
  aboutMe?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  moveInDate?: string | null;
  householdSize?: number | null;
  hasPets?: boolean;
}) {
  return requestProfile<TenantProfileData>('/api/tenant/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

type CreateDocumentUploadUrlData = {
  bucket: string;
  path: string;
  token: string;
};

type ConfirmDocumentUploadData = {
  documentType: TenantProfileDocumentType;
  path: string;
};

function resolveImageContentType(file: File) {
  if (file.type) {
    return file.type;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (name.endsWith('.png')) {
    return 'image/png';
  }
  if (name.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'application/octet-stream';
}

export async function uploadTenantProfileDocument(payload: {
  documentType: TenantProfileDocumentType;
  file: File;
}) {
  const contentType = resolveImageContentType(payload.file);

  const createUploadResult = await requestProfile<CreateDocumentUploadUrlData>(
    '/api/tenant/profile/documents',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'createUploadUrl',
        documentType: payload.documentType,
        fileName: payload.file.name,
        fileSize: payload.file.size,
        contentType,
      }),
    },
  );

  if (!createUploadResult.ok || !createUploadResult.data) {
    throw new Error(createUploadResult.message || 'Failed to prepare document upload.');
  }

  const supabase = getSupabaseBrowserClient();
  const uploadResult = await supabase.storage
    .from(createUploadResult.data.bucket)
    .uploadToSignedUrl(createUploadResult.data.path, createUploadResult.data.token, payload.file);

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || 'Failed to upload document.');
  }

  return requestProfile<ConfirmDocumentUploadData>('/api/tenant/profile/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'confirmUpload',
      documentType: payload.documentType,
      path: createUploadResult.data.path,
      fileName: payload.file.name,
      fileSize: payload.file.size,
      contentType,
    }),
  });
}
