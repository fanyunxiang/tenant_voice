import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedLandlord } from 'lib/landlord/authServer';

type ListingRow = {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  weekly_rent: number | string;
  status: string;
  available_from: string | null;
  created_at: string;
  updated_at: string;
};

type PropertyRow = {
  id: string;
  address_line_1: string;
  suburb: string;
  state: string;
  postcode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  property_type: string;
};

const PENDING_APPLICATION_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'] as const;
const ALLOWED_PROPERTY_TYPES = [
  'APARTMENT',
  'HOUSE',
  'STUDIO',
  'TOWNHOUSE',
  'UNIT',
  'DUPLEX',
  'OTHER',
] as const;

type CreateListingPayload = {
  title: string;
  description: string | null;
  weeklyRent: number;
  availableFrom: string | null;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: (typeof ALLOWED_PROPERTY_TYPES)[number];
};

export async function GET(request: NextRequest) {
  const authResult = await resolveAuthenticatedLandlord(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const supabase = getSupabaseServerClient();

  try {
    const ownedPropertiesResult = await supabase
      .from('properties')
      .select('id')
      .eq('owner_user_id', authResult.data.id);

    if (ownedPropertiesResult.error) {
      throw new Error(`query properties failed: ${ownedPropertiesResult.error.message}`);
    }

    const propertyIds = (ownedPropertiesResult.data ?? []).map((row) => String(row.id));
    if (propertyIds.length === 0) {
      return NextResponse.json({ ok: true, data: { properties: [] } });
    }

    const listingsResult = await supabase
      .from('listings')
      .select('id, property_id, title, description, weekly_rent, status, available_from, created_at, updated_at')
      .in('property_id', propertyIds)
      .order('updated_at', { ascending: false });

    if (listingsResult.error) {
      throw new Error(`query listings failed: ${listingsResult.error.message}`);
    }

    const listings = (listingsResult.data ?? []) as ListingRow[];
    const listingIds = listings.map((listing) => listing.id);

    const propertiesResult = await supabase
      .from('properties')
      .select('id, address_line_1, suburb, state, postcode, bedrooms, bathrooms, property_type')
      .in('id', propertyIds);

    if (propertiesResult.error) {
      throw new Error(`query property details failed: ${propertiesResult.error.message}`);
    }

    const propertiesById = new Map<string, PropertyRow>();
    (propertiesResult.data ?? []).forEach((row) => {
      propertiesById.set(String(row.id), row as PropertyRow);
    });

    let pendingCountsByListingId = new Map<string, number>();
    if (listingIds.length > 0) {
      const pendingApplicationsResult = await supabase
        .from('rental_applications')
        .select('listing_id, status')
        .in('listing_id', listingIds)
        .in('status', [...PENDING_APPLICATION_STATUSES]);

      if (pendingApplicationsResult.error) {
        throw new Error(`query applications failed: ${pendingApplicationsResult.error.message}`);
      }

      pendingCountsByListingId = new Map<string, number>();
      (pendingApplicationsResult.data ?? []).forEach((row) => {
        const listingId = String(row.listing_id);
        pendingCountsByListingId.set(listingId, (pendingCountsByListingId.get(listingId) ?? 0) + 1);
      });
    }

    const payload = listings.map((listing) => {
      const property = propertiesById.get(listing.property_id);
      return {
        listingId: listing.id,
        propertyId: listing.property_id,
        title: listing.title,
        description: listing.description,
        weeklyRent: Number(listing.weekly_rent),
        status: listing.status,
        availableFrom: listing.available_from,
        addressLine1: property?.address_line_1 ?? '',
        suburb: property?.suburb ?? '',
        state: property?.state ?? '',
        postcode: property?.postcode ?? '',
        bedrooms: property?.bedrooms ?? null,
        bathrooms: property?.bathrooms ?? null,
        propertyType: property?.property_type ?? 'OTHER',
        pendingApplications: pendingCountsByListingId.get(listing.id) ?? 0,
        updatedAt: listing.updated_at,
      };
    });

    return NextResponse.json({ ok: true, data: { properties: payload } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load properties.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveAuthenticatedLandlord(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const payloadResult = parseCreateListingPayload(bodyResult.data);
  if (payloadResult.ok === false) {
    return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  try {
    const propertyId = crypto.randomUUID();
    const listingId = crypto.randomUUID();

    const propertyInsertResult = await supabase.from('properties').insert({
      id: propertyId,
      owner_user_id: authResult.data.id,
      manager_user_id: null,
      property_type: payloadResult.data.propertyType,
      nickname: payloadResult.data.title,
      address_line_1: payloadResult.data.addressLine1,
      address_line_2: null,
      suburb: payloadResult.data.suburb,
      state: payloadResult.data.state,
      postcode: payloadResult.data.postcode,
      country: 'AU',
      bedrooms: payloadResult.data.bedrooms,
      bathrooms: payloadResult.data.bathrooms,
      parking_spaces: null,
      pet_friendly: false,
      metadata: null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (propertyInsertResult.error) {
      throw new Error(`create property failed: ${propertyInsertResult.error.message}`);
    }

    const listingInsertResult = await supabase.from('listings').insert({
      id: listingId,
      property_id: propertyId,
      created_by_user_id: authResult.data.id,
      title: payloadResult.data.title,
      description: payloadResult.data.description,
      weekly_rent: payloadResult.data.weeklyRent,
      bond_amount: null,
      available_from: payloadResult.data.availableFrom,
      lease_term_months: null,
      status: 'DRAFT',
      inspection_details: null,
      published_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (listingInsertResult.error) {
      throw new Error(`create listing failed: ${listingInsertResult.error.message}`);
    }

    return NextResponse.json({
      ok: true,
      message: 'Property listing created as draft.',
      data: {
        listingId,
        propertyId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create property listing.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

function parseCreateListingPayload(
  raw: Record<string, unknown>,
): { ok: true; data: CreateListingPayload } | { ok: false; message: string } {
  if (typeof raw.title !== 'string' || raw.title.trim().length < 3) {
    return { ok: false, message: 'title must be at least 3 characters.' };
  }

  const weeklyRent = Number(raw.weeklyRent);
  if (!Number.isFinite(weeklyRent) || weeklyRent <= 0) {
    return { ok: false, message: 'weeklyRent must be a positive number.' };
  }

  const description =
    typeof raw.description === 'string' && raw.description.trim().length > 0
      ? raw.description.trim().slice(0, 3000)
      : null;

  if (typeof raw.addressLine1 !== 'string' || raw.addressLine1.trim().length < 3) {
    return { ok: false, message: 'addressLine1 is required.' };
  }

  if (typeof raw.suburb !== 'string' || raw.suburb.trim().length < 2) {
    return { ok: false, message: 'suburb is required.' };
  }

  if (typeof raw.state !== 'string' || raw.state.trim().length < 2) {
    return { ok: false, message: 'state is required.' };
  }

  if (typeof raw.postcode !== 'string' || raw.postcode.trim().length < 3) {
    return { ok: false, message: 'postcode is required.' };
  }

  const propertyTypeRaw = typeof raw.propertyType === 'string' ? raw.propertyType.trim().toUpperCase() : 'OTHER';
  const propertyType = ALLOWED_PROPERTY_TYPES.includes(
    propertyTypeRaw as (typeof ALLOWED_PROPERTY_TYPES)[number],
  )
    ? (propertyTypeRaw as (typeof ALLOWED_PROPERTY_TYPES)[number])
    : 'OTHER';

  const bedrooms = normalizeNullableInt(raw.bedrooms, 'bedrooms', 0, 20);
  if (bedrooms.ok === false) {
    return bedrooms;
  }

  const bathrooms = normalizeNullableInt(raw.bathrooms, 'bathrooms', 0, 20);
  if (bathrooms.ok === false) {
    return bathrooms;
  }

  const availableFrom = normalizeNullableDate(raw.availableFrom, 'availableFrom');
  if (availableFrom.ok === false) {
    return availableFrom;
  }

  return {
    ok: true,
    data: {
      title: raw.title.trim().slice(0, 180),
      description,
      weeklyRent: Number(weeklyRent.toFixed(2)),
      availableFrom: availableFrom.value,
      addressLine1: raw.addressLine1.trim().slice(0, 180),
      suburb: raw.suburb.trim().slice(0, 100),
      state: raw.state.trim().toUpperCase().slice(0, 10),
      postcode: raw.postcode.trim().slice(0, 10),
      bedrooms: bedrooms.value,
      bathrooms: bathrooms.value,
      propertyType,
    },
  };
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
    return {
      ok: false,
      message: `${fieldName} must be an integer between ${min} and ${max}.`,
    };
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
