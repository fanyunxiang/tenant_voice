import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';
import { resolveAuthenticatedAppUser } from 'lib/landlord/authServer';
import {
  TENANT_OPTIONAL_DOCUMENTS,
  TENANT_REQUIRED_DOCUMENTS,
  TenantProfileDocumentType,
} from 'lib/tenant/profile';

const PROFILE_DOCUMENTS_BUCKET = process.env.SUPABASE_PROFILE_DOCUMENTS_BUCKET ?? 'profile-documents';
const MAX_UPLOAD_FILE_BYTES = 3 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 120;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const SUPPORTED_DOCUMENT_TYPES = new Set<TenantProfileDocumentType>([
  ...TENANT_REQUIRED_DOCUMENTS.map((item) => item.type),
  ...TENANT_OPTIONAL_DOCUMENTS.map((item) => item.type),
]);

type AppUserAuthContext = {
  appUser: {
    id: string;
    primary_role: string;
  };
};

type CreateUploadUrlPayload = {
  documentType: TenantProfileDocumentType;
  fileName: string;
  fileSize: number;
  contentType: string;
};

type ConfirmUploadPayload = {
  documentType: TenantProfileDocumentType;
  path: string;
  fileName: string;
  fileSize: number;
  contentType: string;
};

export async function POST(request: NextRequest) {
  const authResult = await resolveAuthenticatedTenant(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const action = bodyResult.data.action;
  if (action === 'createUploadUrl') {
    const payloadResult = parseCreateUploadUrlPayload(bodyResult.data);
    if (payloadResult.ok === false) {
      return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
    }
    return createDocumentUploadUrl(authResult.data, payloadResult.data);
  }

  if (action === 'confirmUpload') {
    const payloadResult = parseConfirmUploadPayload(bodyResult.data);
    if (payloadResult.ok === false) {
      return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
    }
    return confirmDocumentUpload(authResult.data, payloadResult.data);
  }

  return NextResponse.json(
    { ok: false, message: 'Unsupported action. Use createUploadUrl or confirmUpload.' },
    { status: 400 },
  );
}

async function createDocumentUploadUrl(
  context: AppUserAuthContext,
  payload: CreateUploadUrlPayload,
) {
  if (!SUPPORTED_DOCUMENT_TYPES.has(payload.documentType)) {
    return NextResponse.json({ ok: false, message: 'Unsupported document type.' }, { status: 400 });
  }

  const safeFileName = sanitizeFileName(payload.fileName);
  const path = [
    context.appUser.id,
    payload.documentType,
    `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`,
  ].join('/');

  const supabase = getSupabaseServerClient();
  const signedUrlResult = await supabase.storage
    .from(PROFILE_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (signedUrlResult.error || !signedUrlResult.data?.token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          signedUrlResult.error?.message ||
          `Failed to prepare upload URL. Ensure bucket "${PROFILE_DOCUMENTS_BUCKET}" exists.`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      bucket: PROFILE_DOCUMENTS_BUCKET,
      path,
      token: signedUrlResult.data.token,
    },
  });
}

async function confirmDocumentUpload(
  context: AppUserAuthContext,
  payload: ConfirmUploadPayload,
) {
  if (!SUPPORTED_DOCUMENT_TYPES.has(payload.documentType)) {
    return NextResponse.json({ ok: false, message: 'Unsupported document type.' }, { status: 400 });
  }

  const expectedPrefix = `${context.appUser.id}/${payload.documentType}/`;
  if (!payload.path.startsWith(expectedPrefix)) {
    return NextResponse.json({ ok: false, message: 'Invalid uploaded file path.' }, { status: 400 });
  }

  const requiredDefinition = TENANT_REQUIRED_DOCUMENTS.find((item) => item.type === payload.documentType);
  const nowIso = new Date().toISOString();
  const supabase = getSupabaseServerClient();

  const existingDocumentResult = await supabase
    .from('profile_documents')
    .select('id')
    .eq('user_id', context.appUser.id)
    .eq('document_type', payload.documentType)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (existingDocumentResult.error) {
    return NextResponse.json(
      { ok: false, message: `Failed to load existing document row: ${existingDocumentResult.error.message}` },
      { status: 500 },
    );
  }

  const writePayload = {
    file_url: payload.path,
    points_value: requiredDefinition?.points ?? 0,
    is_required: Boolean(requiredDefinition),
    is_verified: false,
    verified_by_user_id: null,
    verified_at: null,
    metadata: {
      storageBucket: PROFILE_DOCUMENTS_BUCKET,
      storagePath: payload.path,
      originalFileName: payload.fileName,
      fileSize: payload.fileSize,
      contentType: payload.contentType,
      uploadedAt: nowIso,
      reviewStatus: 'PENDING',
    },
    updated_at: nowIso,
  };

  const existingDocumentId =
    Array.isArray(existingDocumentResult.data) && existingDocumentResult.data.length > 0
      ? existingDocumentResult.data[0].id
      : null;

  if (existingDocumentId) {
    const updateResult = await supabase
      .from('profile_documents')
      .update(writePayload)
      .eq('id', existingDocumentId);

    if (updateResult.error) {
      return NextResponse.json(
        { ok: false, message: `Failed to update document row: ${updateResult.error.message}` },
        { status: 500 },
      );
    }
  } else {
    const insertResult = await supabase.from('profile_documents').insert({
      id: crypto.randomUUID(),
      user_id: context.appUser.id,
      document_type: payload.documentType,
      ...writePayload,
      created_at: nowIso,
    });

    if (insertResult.error) {
      return NextResponse.json(
        { ok: false, message: `Failed to create document row: ${insertResult.error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    message: 'Document uploaded. Status is pending review.',
    data: {
      documentType: payload.documentType,
      path: payload.path,
      reviewStatus: 'PENDING',
    },
  });
}

function parseCreateUploadUrlPayload(
  raw: Record<string, unknown>,
):
  | { ok: true; data: CreateUploadUrlPayload }
  | { ok: false; message: string } {
  if (!isValidDocumentType(raw.documentType)) {
    return { ok: false, message: 'documentType is invalid.' };
  }

  if (typeof raw.fileName !== 'string' || raw.fileName.trim().length === 0) {
    return { ok: false, message: 'fileName is required.' };
  }

  if (typeof raw.fileSize !== 'number' || !Number.isFinite(raw.fileSize) || raw.fileSize <= 0) {
    return { ok: false, message: 'fileSize must be a positive number.' };
  }

  if (raw.fileSize > MAX_UPLOAD_FILE_BYTES) {
    return {
      ok: false,
      message: `File is too large. Maximum size is ${Math.round(MAX_UPLOAD_FILE_BYTES / 1024 / 1024)}MB.`,
    };
  }

  if (typeof raw.contentType !== 'string' || !ALLOWED_CONTENT_TYPES.has(raw.contentType)) {
    return { ok: false, message: 'Unsupported file type. Use JPG, PNG, or WEBP.' };
  }

  return {
    ok: true,
    data: {
      documentType: raw.documentType,
      fileName: raw.fileName.trim(),
      fileSize: raw.fileSize,
      contentType: raw.contentType,
    },
  };
}

function parseConfirmUploadPayload(
  raw: Record<string, unknown>,
):
  | { ok: true; data: ConfirmUploadPayload }
  | { ok: false; message: string } {
  if (!isValidDocumentType(raw.documentType)) {
    return { ok: false, message: 'documentType is invalid.' };
  }

  if (typeof raw.path !== 'string' || raw.path.trim().length === 0) {
    return { ok: false, message: 'path is required.' };
  }

  if (typeof raw.fileName !== 'string' || raw.fileName.trim().length === 0) {
    return { ok: false, message: 'fileName is required.' };
  }

  if (typeof raw.fileSize !== 'number' || !Number.isFinite(raw.fileSize) || raw.fileSize <= 0) {
    return { ok: false, message: 'fileSize must be a positive number.' };
  }

  if (raw.fileSize > MAX_UPLOAD_FILE_BYTES) {
    return {
      ok: false,
      message: `File is too large. Maximum size is ${Math.round(MAX_UPLOAD_FILE_BYTES / 1024 / 1024)}MB.`,
    };
  }

  if (typeof raw.contentType !== 'string' || !ALLOWED_CONTENT_TYPES.has(raw.contentType)) {
    return { ok: false, message: 'contentType is invalid.' };
  }

  return {
    ok: true,
    data: {
      documentType: raw.documentType,
      path: raw.path.trim(),
      fileName: raw.fileName.trim(),
      fileSize: raw.fileSize,
      contentType: raw.contentType,
    },
  };
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim().slice(0, MAX_FILE_NAME_LENGTH);
  const replaced = trimmed.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
  return replaced.length > 0 ? replaced : 'document';
}

function isValidDocumentType(value: unknown): value is TenantProfileDocumentType {
  return typeof value === 'string' && SUPPORTED_DOCUMENT_TYPES.has(value as TenantProfileDocumentType);
}

async function resolveAuthenticatedTenant(
  request: NextRequest,
): Promise<
  | {
      ok: true;
      data: AppUserAuthContext;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const authResult = await resolveAuthenticatedAppUser(request);
  if (authResult.ok === false) {
    return {
      ok: false,
      response: authResult.response,
    };
  }

  if (authResult.data.primaryRole !== 'TENANT') {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Tenant document upload is only available for tenant accounts.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    data: {
      appUser: {
        id: authResult.data.id,
        primary_role: authResult.data.primaryRole,
      },
    },
  };
}
