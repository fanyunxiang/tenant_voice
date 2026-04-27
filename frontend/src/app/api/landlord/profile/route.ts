import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedLandlord } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';
import { LandlordProfileData } from 'lib/landlord/profile';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
};

type LandlordProfileRow = {
  agency_name: string | null;
  license_number: string | null;
  portfolio_size: number | null;
  verification_status: string | null;
};

export async function GET(request: NextRequest) {
  const authResult = await resolveAuthenticatedLandlord(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  try {
    const data = await buildLandlordProfileResponse(authResult.data.id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load landlord profile.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await resolveAuthenticatedLandlord(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const payloadResult = parsePatchPayload(bodyResult.data);
  if (payloadResult.ok === false) {
    return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  try {
    if (payloadResult.data.userUpdate) {
      const updateUserResult = await supabase
        .from('users')
        .update({
          ...payloadResult.data.userUpdate,
          updated_at: nowIso,
        })
        .eq('id', authResult.data.id);

      if (updateUserResult.error) {
        throw new Error(`update user failed: ${updateUserResult.error.message}`);
      }
    }

    if (payloadResult.data.profileUpdate) {
      const upsertProfileResult = await supabase.from('landlord_profiles').upsert(
        {
          user_id: authResult.data.id,
          ...payloadResult.data.profileUpdate,
          updated_at: nowIso,
          created_at: nowIso,
        },
        { onConflict: 'user_id' },
      );

      if (upsertProfileResult.error) {
        throw new Error(`upsert landlord profile failed: ${upsertProfileResult.error.message}`);
      }
    }

    const data = await buildLandlordProfileResponse(authResult.data.id);
    return NextResponse.json({
      ok: true,
      message: 'Profile updated successfully.',
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update landlord profile.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

async function buildLandlordProfileResponse(userId: string): Promise<LandlordProfileData> {
  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const userResult = await supabase
    .from('users')
    .select('id, email, full_name, phone')
    .eq('id', userId)
    .single();

  if (userResult.error || !userResult.data) {
    throw new Error(`query user failed: ${userResult.error?.message || 'User not found.'}`);
  }

  const profileResult = await supabase
    .from('landlord_profiles')
    .select('agency_name, license_number, portfolio_size, verification_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(`query landlord profile failed: ${profileResult.error.message}`);
  }

  let profile = (profileResult.data ?? null) as LandlordProfileRow | null;

  if (!profile) {
    const createProfileResult = await supabase.from('landlord_profiles').upsert(
      {
        user_id: userId,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' },
    );

    if (createProfileResult.error) {
      throw new Error(`create landlord profile failed: ${createProfileResult.error.message}`);
    }

    profile = {
      agency_name: null,
      license_number: null,
      portfolio_size: null,
      verification_status: null,
    };
  }

  const user = userResult.data as UserRow;

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
    },
    profile: {
      agencyName: normalizeNullableString(profile.agency_name),
      licenseNumber: normalizeNullableString(profile.license_number),
      portfolioSize: normalizeNullableInteger(profile.portfolio_size),
      verificationStatus: normalizeNullableString(profile.verification_status),
    },
  };
}

function parsePatchPayload(
  raw: Record<string, unknown>,
):
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
    userUpdate.full_name = typeof raw.fullName === 'string' ? normalizeNullableString(raw.fullName, 120) : null;
  }

  if ('phone' in raw) {
    if (raw.phone !== null && typeof raw.phone !== 'string') {
      return { ok: false, message: 'phone must be a string.' };
    }
    userUpdate.phone = typeof raw.phone === 'string' ? normalizeNullableString(raw.phone, 40) : null;
  }

  if ('agencyName' in raw) {
    if (raw.agencyName !== null && typeof raw.agencyName !== 'string') {
      return { ok: false, message: 'agencyName must be a string.' };
    }
    profileUpdate.agency_name =
      typeof raw.agencyName === 'string' ? normalizeNullableString(raw.agencyName, 200) : null;
  }

  if ('licenseNumber' in raw) {
    if (raw.licenseNumber !== null && typeof raw.licenseNumber !== 'string') {
      return { ok: false, message: 'licenseNumber must be a string.' };
    }
    profileUpdate.license_number =
      typeof raw.licenseNumber === 'string' ? normalizeNullableString(raw.licenseNumber, 120) : null;
  }

  if ('verificationStatus' in raw) {
    if (raw.verificationStatus !== null && typeof raw.verificationStatus !== 'string') {
      return { ok: false, message: 'verificationStatus must be a string.' };
    }
    profileUpdate.verification_status =
      typeof raw.verificationStatus === 'string'
        ? normalizeNullableString(raw.verificationStatus, 80)
        : null;
  }

  if ('portfolioSize' in raw) {
    if (raw.portfolioSize === null || raw.portfolioSize === '') {
      profileUpdate.portfolio_size = null;
    } else {
      const parsed = Number(raw.portfolioSize);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) {
        return { ok: false, message: 'portfolioSize must be an integer between 0 and 100000.' };
      }
      profileUpdate.portfolio_size = parsed;
    }
  }

  return {
    ok: true,
    data: {
      userUpdate: Object.keys(userUpdate).length > 0 ? userUpdate : null,
      profileUpdate: Object.keys(profileUpdate).length > 0 ? profileUpdate : null,
    },
  };
}

function normalizeNullableString(input: unknown, maxLength = 200): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeNullableInteger(input: unknown): number | null {
  if (typeof input === 'number' && Number.isInteger(input)) {
    return input;
  }

  if (typeof input === 'string') {
    const parsed = Number(input);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
}
