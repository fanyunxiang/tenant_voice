import { NextRequest, NextResponse } from 'next/server';
import { findAppUserByAuthUserId } from 'lib/auth/userProvisioning';
import { ACCESS_TOKEN_COOKIE } from 'lib/auth/constants';
import { parseJsonBody } from 'lib/auth/validation';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';
import {
  TENANT_OPTIONAL_DOCUMENTS,
  TENANT_REQUIRED_DOCUMENTS,
  TenantProfileData,
} from 'lib/tenant/profile';

type ProfileDocumentRow = {
  document_type: string | null;
  file_url: string | null;
  is_verified: boolean | null;
};

type TenantProfileRow = {
  about_me: string | null;
  preferred_locations: unknown;
  budget_min: number | string | null;
  budget_max: number | string | null;
  move_in_date: string | null;
  household_size: number | null;
  has_pets: boolean | null;
};

type AppUserAuthContext = {
  appUser: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    primary_role: string;
  };
};

export async function GET(request: NextRequest) {
  return getTenantProfile(request);
}

export async function PATCH(request: NextRequest) {
  return updateTenantProfile(request);
}

async function getTenantProfile(request: NextRequest) {
  const authResult = await resolveAuthenticatedTenant(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  try {
    const data = await buildTenantProfileResponse(authResult.data);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load tenant profile.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

async function updateTenantProfile(request: NextRequest) {
  const authResult = await resolveAuthenticatedTenant(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const parseResult = parsePatchPayload(bodyResult.data);
  if (parseResult.ok === false) {
    return NextResponse.json({ ok: false, message: parseResult.message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  try {
    const { appUser } = authResult.data;
    const { userUpdate, profileUpdate } = parseResult.data;

    if (userUpdate) {
      const updateUserResult = await supabase
        .from('users')
        .update({ ...userUpdate, updated_at: nowIso })
        .eq('id', appUser.id);

      if (updateUserResult.error) {
        throw new Error(`update user failed: ${updateUserResult.error.message}`);
      }
    }

    if (profileUpdate) {
      const upsertProfileResult = await supabase.from('tenant_profiles').upsert(
        {
          user_id: appUser.id,
          ...profileUpdate,
          updated_at: nowIso,
          created_at: nowIso,
        },
        { onConflict: 'user_id' },
      );

      if (upsertProfileResult.error) {
        throw new Error(`upsert tenant profile failed: ${upsertProfileResult.error.message}`);
      }
    }

    const freshAuthResult = await resolveAuthenticatedTenant(request);
    if (freshAuthResult.ok === false) {
      return freshAuthResult.response;
    }

    const data = await buildTenantProfileResponse(freshAuthResult.data);
    return NextResponse.json({
      ok: true,
      message: 'Profile updated successfully.',
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update tenant profile.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
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

  if (appUser.primary_role !== 'TENANT') {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Tenant profile API is only available for tenant accounts.' },
        { status: 403 },
      ),
    };
  }

  const supabase = getSupabaseServerClient();
  const currentUserResult = await supabase
    .from('users')
    .select('id, email, full_name, phone, primary_role')
    .eq('id', appUser.id)
    .single();

  if (currentUserResult.error || !currentUserResult.data) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: 'Unable to load user profile.' }, { status: 500 }),
    };
  }

  return {
    ok: true,
    data: {
      appUser: currentUserResult.data as AppUserAuthContext['appUser'],
    },
  };
}

async function buildTenantProfileResponse(context: AppUserAuthContext): Promise<TenantProfileData> {
  const supabase = getSupabaseServerClient();
  const { appUser } = context;
  const nowIso = new Date().toISOString();

  const profileResult = await supabase
    .from('tenant_profiles')
    .select(
      'about_me, preferred_locations, budget_min, budget_max, move_in_date, household_size, has_pets',
    )
    .eq('user_id', appUser.id)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(`query tenant profile failed: ${profileResult.error.message}`);
  }

  let tenantProfile = profileResult.data as TenantProfileRow | null;
  if (!tenantProfile) {
    const createProfileResult = await supabase.from('tenant_profiles').upsert(
      {
        user_id: appUser.id,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' },
    );

    if (createProfileResult.error) {
      throw new Error(`create tenant profile failed: ${createProfileResult.error.message}`);
    }

    tenantProfile = {
      about_me: null,
      preferred_locations: [],
      budget_min: null,
      budget_max: null,
      move_in_date: null,
      household_size: null,
      has_pets: false,
    };
  }

  const documentsResult = await supabase
    .from('profile_documents')
    .select('document_type, file_url, is_verified')
    .eq('user_id', appUser.id);

  if (documentsResult.error) {
    throw new Error(`query profile documents failed: ${documentsResult.error.message}`);
  }

  const documents = (documentsResult.data ?? []) as ProfileDocumentRow[];
  const documentsByType = new Map<string, ProfileDocumentRow>();
  documents.forEach((document) => {
    if (document.document_type) {
      documentsByType.set(document.document_type, document);
    }
  });

  const requiredDocuments = TENANT_REQUIRED_DOCUMENTS.map((definition) => {
    const row = documentsByType.get(definition.type);
    const uploaded = Boolean(row?.file_url);
    return {
      id: definition.id,
      type: definition.type,
      label: definition.label,
      points: definition.points,
      uploaded,
      verified: Boolean(row?.is_verified),
    };
  });

  const optionalDocuments = TENANT_OPTIONAL_DOCUMENTS.map((definition) => {
    const row = documentsByType.get(definition.type);
    const uploaded = Boolean(row?.file_url);
    return {
      id: definition.id,
      type: definition.type,
      label: definition.label,
      weight: definition.weight,
      uploaded,
      verified: Boolean(row?.is_verified),
    };
  });

  const requiredPointsUploaded = requiredDocuments.reduce((sum, item) => {
    return item.uploaded ? sum + item.points : sum;
  }, 0);
  const requiredCompleted = Math.round((Math.min(90, requiredPointsUploaded) / 90) * 50);

  const optionalCompleted = optionalDocuments.reduce((sum, item) => {
    return item.uploaded ? sum + item.weight : sum;
  }, 0);

  return {
    user: {
      id: appUser.id,
      email: appUser.email,
      fullName: appUser.full_name,
      phone: appUser.phone,
    },
    profile: {
      aboutMe: normalizeNullableString(tenantProfile.about_me),
      preferredAreas: normalizePreferredAreas(tenantProfile.preferred_locations),
      budgetMin: normalizeNullableNumber(tenantProfile.budget_min),
      budgetMax: normalizeNullableNumber(tenantProfile.budget_max),
      moveInDate: normalizeNullableDate(tenantProfile.move_in_date),
      householdSize: normalizeNullableInteger(tenantProfile.household_size),
      hasPets: Boolean(tenantProfile.has_pets),
    },
    completion: {
      requiredCompleted,
      optionalCompleted,
      total: Math.min(100, requiredCompleted + optionalCompleted),
    },
    requiredDocuments,
    optionalDocuments,
  };
}

function parsePatchPayload(raw: Record<string, unknown>):
  | {
      ok: true;
      data: {
        userUpdate: Record<string, unknown> | null;
        profileUpdate: Record<string, unknown> | null;
      };
    }
  | { ok: false; message: string } {
  const userUpdate: Record<string, unknown> = {};
  const profileUpdate: Record<string, unknown> = {};

  if ('fullName' in raw) {
    if (raw.fullName !== null && typeof raw.fullName !== 'string') {
      return { ok: false, message: 'fullName must be a string.' };
    }
    userUpdate.full_name =
      typeof raw.fullName === 'string' ? normalizeNullableString(raw.fullName, 120) : null;
  }

  if ('phone' in raw) {
    if (raw.phone !== null && typeof raw.phone !== 'string') {
      return { ok: false, message: 'phone must be a string.' };
    }
    userUpdate.phone = typeof raw.phone === 'string' ? normalizeNullableString(raw.phone, 40) : null;
  }

  if ('preferredAreas' in raw) {
    if (!Array.isArray(raw.preferredAreas)) {
      return { ok: false, message: 'preferredAreas must be an array of strings.' };
    }

    const normalizedPreferredAreas = raw.preferredAreas
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 12);

    if (normalizedPreferredAreas.length !== raw.preferredAreas.length) {
      return { ok: false, message: 'preferredAreas can only contain non-empty strings.' };
    }

    profileUpdate.preferred_locations = normalizedPreferredAreas;
  }

  if ('aboutMe' in raw) {
    if (raw.aboutMe !== null && typeof raw.aboutMe !== 'string') {
      return { ok: false, message: 'aboutMe must be a string.' };
    }
    profileUpdate.about_me =
      typeof raw.aboutMe === 'string' ? normalizeNullableString(raw.aboutMe, 2000) : null;
  }

  if ('budgetMin' in raw) {
    const result = normalizePatchNumber(raw.budgetMin, 'budgetMin');
    if (result.ok === false) {
      return result;
    }
    profileUpdate.budget_min = result.value;
  }

  if ('budgetMax' in raw) {
    const result = normalizePatchNumber(raw.budgetMax, 'budgetMax');
    if (result.ok === false) {
      return result;
    }
    profileUpdate.budget_max = result.value;
  }

  if (
    profileUpdate.budget_min !== undefined &&
    profileUpdate.budget_max !== undefined &&
    profileUpdate.budget_min !== null &&
    profileUpdate.budget_max !== null &&
    Number(profileUpdate.budget_min) > Number(profileUpdate.budget_max)
  ) {
    return { ok: false, message: 'budgetMin cannot be greater than budgetMax.' };
  }

  if ('moveInDate' in raw) {
    const rawMoveInDate = raw.moveInDate;
    if (rawMoveInDate === null || rawMoveInDate === undefined) {
      profileUpdate.move_in_date = null;
    } else if (typeof rawMoveInDate !== 'string') {
      return { ok: false, message: 'moveInDate must be a string in YYYY-MM-DD format.' };
    } else {
      const normalizedMoveInDate = rawMoveInDate.trim();
      if (normalizedMoveInDate === '') {
        profileUpdate.move_in_date = null;
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedMoveInDate)) {
        return { ok: false, message: 'moveInDate must be in YYYY-MM-DD format.' };
      } else {
        profileUpdate.move_in_date = normalizedMoveInDate;
      }
    }
  }

  if ('householdSize' in raw) {
    if (raw.householdSize === null || raw.householdSize === undefined) {
      profileUpdate.household_size = null;
    } else if (
      typeof raw.householdSize !== 'number' ||
      !Number.isFinite(raw.householdSize) ||
      !Number.isInteger(raw.householdSize) ||
      raw.householdSize < 1 ||
      raw.householdSize > 20
    ) {
      return { ok: false, message: 'householdSize must be an integer between 1 and 20.' };
    } else {
      profileUpdate.household_size = raw.householdSize;
    }
  }

  if ('hasPets' in raw) {
    if (typeof raw.hasPets !== 'boolean') {
      return { ok: false, message: 'hasPets must be a boolean value.' };
    }
    profileUpdate.has_pets = raw.hasPets;
  }

  return {
    ok: true,
    data: {
      userUpdate: Object.keys(userUpdate).length > 0 ? userUpdate : null,
      profileUpdate: Object.keys(profileUpdate).length > 0 ? profileUpdate : null,
    },
  };
}

function normalizePatchNumber(
  value: unknown,
  fieldName: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return { ok: false, message: `${fieldName} must be a non-negative number or null.` };
  }

  return { ok: true, value };
}

function normalizeNullableString(value: unknown, maxLength = 400): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().slice(0, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.trunc(numberValue);
}

function normalizeNullableDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizePreferredAreas(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}
