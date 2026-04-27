import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedLandlord } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

const ALLOWED_LISTING_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'APPLICATIONS_CLOSED',
  'LEASED',
  'ARCHIVED',
] as const;

type UpdatePayload = {
  action: 'update';
  title?: string;
  description?: string | null;
  weeklyRent?: number;
  availableFrom?: string | null;
  addressLine1?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
};

type SetStatusPayload = {
  action: 'setStatus';
  status: (typeof ALLOWED_LISTING_STATUSES)[number];
};

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ listingId: string }>;
  },
) {
  const authResult = await resolveAuthenticatedLandlord(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const { listingId } = await context.params;
  const listingIdTrimmed = listingId.trim();
  if (!listingIdTrimmed) {
    return NextResponse.json({ ok: false, message: 'listingId is required.' }, { status: 400 });
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
  const listingResult = await supabase
    .from('listings')
    .select('id, property_id, published_at')
    .eq('id', listingIdTrimmed)
    .maybeSingle();

  if (listingResult.error || !listingResult.data) {
    return NextResponse.json({ ok: false, message: 'Listing not found.' }, { status: 404 });
  }

  const propertyOwnerResult = await supabase
    .from('properties')
    .select('id')
    .eq('id', listingResult.data.property_id)
    .eq('owner_user_id', authResult.data.id)
    .maybeSingle();

  if (propertyOwnerResult.error || !propertyOwnerResult.data) {
    return NextResponse.json(
      { ok: false, message: 'You do not have access to this listing.' },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();

  if (payloadResult.data.action === 'setStatus') {
    const statusUpdate: Record<string, unknown> = {
      status: payloadResult.data.status,
      updated_at: nowIso,
    };

    if (payloadResult.data.status === 'PUBLISHED' && !listingResult.data.published_at) {
      statusUpdate.published_at = nowIso;
    }

    const statusResult = await supabase
      .from('listings')
      .update(statusUpdate)
      .eq('id', listingIdTrimmed);

    if (statusResult.error) {
      return NextResponse.json(
        { ok: false, message: `Failed to update listing status: ${statusResult.error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, message: 'Listing status updated.' });
  }

  const listingUpdate: Record<string, unknown> = { updated_at: nowIso };
  const propertyUpdate: Record<string, unknown> = { updated_at: nowIso };

  if (payloadResult.data.title !== undefined) {
    listingUpdate.title = payloadResult.data.title;
  }
  if (payloadResult.data.description !== undefined) {
    listingUpdate.description = payloadResult.data.description;
  }
  if (payloadResult.data.weeklyRent !== undefined) {
    listingUpdate.weekly_rent = payloadResult.data.weeklyRent;
  }
  if (payloadResult.data.availableFrom !== undefined) {
    listingUpdate.available_from = payloadResult.data.availableFrom;
  }

  if (payloadResult.data.addressLine1 !== undefined) {
    propertyUpdate.address_line_1 = payloadResult.data.addressLine1;
  }
  if (payloadResult.data.suburb !== undefined) {
    propertyUpdate.suburb = payloadResult.data.suburb;
  }
  if (payloadResult.data.state !== undefined) {
    propertyUpdate.state = payloadResult.data.state;
  }
  if (payloadResult.data.postcode !== undefined) {
    propertyUpdate.postcode = payloadResult.data.postcode;
  }
  if (payloadResult.data.bedrooms !== undefined) {
    propertyUpdate.bedrooms = payloadResult.data.bedrooms;
  }
  if (payloadResult.data.bathrooms !== undefined) {
    propertyUpdate.bathrooms = payloadResult.data.bathrooms;
  }

  const listingUpdateResult = await supabase
    .from('listings')
    .update(listingUpdate)
    .eq('id', listingIdTrimmed);

  if (listingUpdateResult.error) {
    return NextResponse.json(
      { ok: false, message: `Failed to update listing: ${listingUpdateResult.error.message}` },
      { status: 500 },
    );
  }

  if (Object.keys(propertyUpdate).length > 1) {
    const propertyUpdateResult = await supabase
      .from('properties')
      .update(propertyUpdate)
      .eq('id', listingResult.data.property_id);

    if (propertyUpdateResult.error) {
      return NextResponse.json(
        { ok: false, message: `Listing updated but property update failed: ${propertyUpdateResult.error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, message: 'Listing updated.' });
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ listingId: string }>;
  },
) {
  const authResult = await resolveAuthenticatedLandlord(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const { listingId } = await context.params;
  const listingIdTrimmed = listingId.trim();
  if (!listingIdTrimmed) {
    return NextResponse.json({ ok: false, message: 'listingId is required.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const listingResult = await supabase
    .from('listings')
    .select('id, property_id')
    .eq('id', listingIdTrimmed)
    .maybeSingle();

  if (listingResult.error || !listingResult.data) {
    return NextResponse.json({ ok: false, message: 'Listing not found.' }, { status: 404 });
  }

  const propertyOwnerResult = await supabase
    .from('properties')
    .select('id')
    .eq('id', listingResult.data.property_id)
    .eq('owner_user_id', authResult.data.id)
    .maybeSingle();

  if (propertyOwnerResult.error || !propertyOwnerResult.data) {
    return NextResponse.json(
      { ok: false, message: 'You do not have access to this listing.' },
      { status: 403 },
    );
  }

  const deleteResult = await supabase.from('listings').delete().eq('id', listingIdTrimmed);
  if (deleteResult.error) {
    return NextResponse.json(
      { ok: false, message: `Failed to delete listing: ${deleteResult.error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: 'Listing deleted.' });
}

function parsePatchPayload(
  raw: Record<string, unknown>,
):
  | { ok: true; data: UpdatePayload | SetStatusPayload }
  | { ok: false; message: string } {
  if (raw.action === 'setStatus') {
    const statusRaw = typeof raw.status === 'string' ? raw.status.trim().toUpperCase() : '';
    if (!ALLOWED_LISTING_STATUSES.includes(statusRaw as (typeof ALLOWED_LISTING_STATUSES)[number])) {
      return { ok: false, message: 'status is invalid.' };
    }

    return {
      ok: true,
      data: {
        action: 'setStatus',
        status: statusRaw as (typeof ALLOWED_LISTING_STATUSES)[number],
      },
    };
  }

  if (raw.action !== 'update') {
    return { ok: false, message: 'action must be update or setStatus.' };
  }

  const updatePayload: UpdatePayload = { action: 'update' };

  if ('title' in raw) {
    if (typeof raw.title !== 'string' || raw.title.trim().length < 3) {
      return { ok: false, message: 'title must be at least 3 characters.' };
    }
    updatePayload.title = raw.title.trim().slice(0, 180);
  }

  if ('description' in raw) {
    if (raw.description !== null && typeof raw.description !== 'string') {
      return { ok: false, message: 'description must be a string or null.' };
    }
    updatePayload.description =
      typeof raw.description === 'string' && raw.description.trim().length > 0
        ? raw.description.trim().slice(0, 3000)
        : null;
  }

  if ('weeklyRent' in raw) {
    const weeklyRent = Number(raw.weeklyRent);
    if (!Number.isFinite(weeklyRent) || weeklyRent <= 0) {
      return { ok: false, message: 'weeklyRent must be a positive number.' };
    }
    updatePayload.weeklyRent = Number(weeklyRent.toFixed(2));
  }

  if ('availableFrom' in raw) {
    const dateResult = normalizeNullableDate(raw.availableFrom, 'availableFrom');
    if (dateResult.ok === false) {
      return dateResult;
    }
    updatePayload.availableFrom = dateResult.value;
  }

  if ('addressLine1' in raw) {
    if (typeof raw.addressLine1 !== 'string' || raw.addressLine1.trim().length < 3) {
      return { ok: false, message: 'addressLine1 is required.' };
    }
    updatePayload.addressLine1 = raw.addressLine1.trim().slice(0, 180);
  }

  if ('suburb' in raw) {
    if (typeof raw.suburb !== 'string' || raw.suburb.trim().length < 2) {
      return { ok: false, message: 'suburb is required.' };
    }
    updatePayload.suburb = raw.suburb.trim().slice(0, 100);
  }

  if ('state' in raw) {
    if (typeof raw.state !== 'string' || raw.state.trim().length < 2) {
      return { ok: false, message: 'state is required.' };
    }
    updatePayload.state = raw.state.trim().toUpperCase().slice(0, 10);
  }

  if ('postcode' in raw) {
    if (typeof raw.postcode !== 'string' || raw.postcode.trim().length < 3) {
      return { ok: false, message: 'postcode is required.' };
    }
    updatePayload.postcode = raw.postcode.trim().slice(0, 10);
  }

  if ('bedrooms' in raw) {
    const result = normalizeNullableInt(raw.bedrooms, 'bedrooms', 0, 20);
    if (result.ok === false) {
      return result;
    }
    updatePayload.bedrooms = result.value;
  }

  if ('bathrooms' in raw) {
    const result = normalizeNullableInt(raw.bathrooms, 'bathrooms', 0, 20);
    if (result.ok === false) {
      return result;
    }
    updatePayload.bathrooms = result.value;
  }

  return { ok: true, data: updatePayload };
}

function normalizeNullableInt(
  raw: unknown,
  fieldName: string,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null };
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { ok: false, message: `${fieldName} must be an integer between ${min} and ${max}.` };
  }

  return { ok: true, value: parsed };
}

function normalizeNullableDate(
  raw: unknown,
  fieldName: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null };
  }

  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return { ok: false, message: `${fieldName} must be in YYYY-MM-DD format.` };
  }

  return { ok: true, value: raw.trim() };
}
