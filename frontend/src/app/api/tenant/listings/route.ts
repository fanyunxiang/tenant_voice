import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedAppUser } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

type ListingRow = {
  id: string;
  property_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  weekly_rent: number | string;
  available_from: string | null;
  status: string;
  published_at: string | null;
};

type PropertyRow = {
  id: string;
  address_line_1: string;
  suburb: string;
  state: string;
  postcode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  pet_friendly: boolean | null;
  property_type: string;
};

type PropertyMediaRow = {
  property_id: string;
  media_url: string;
  is_cover: boolean | null;
  sort_order: number | null;
  created_at: string;
};

type LandlordRow = {
  id: string;
  full_name: string | null;
  email: string;
};

const MAX_LISTINGS_SCAN = 1000;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 24;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseNullableNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get('q') ?? '';
  const rawLocation = request.nextUrl.searchParams.get('location') ?? '';
  const rawPropertyType = request.nextUrl.searchParams.get('propertyType') ?? '';
  const rawMinPrice = request.nextUrl.searchParams.get('minPrice') ?? '';
  const rawMaxPrice = request.nextUrl.searchParams.get('maxPrice') ?? '';
  const rawMinBedrooms = request.nextUrl.searchParams.get('minBedrooms') ?? '';

  const query = rawQuery.trim().toLowerCase();
  const locationFilter = rawLocation.trim().toLowerCase();
  const propertyTypeFilter = rawPropertyType.trim().toUpperCase();
  const hasFilterConditions = Boolean(
    query ||
      locationFilter ||
      (propertyTypeFilter && propertyTypeFilter !== 'ALL') ||
      rawMinPrice.trim() ||
      rawMaxPrice.trim() ||
      rawMinBedrooms.trim(),
  );

  if (hasFilterConditions) {
    const authResult = await resolveAuthenticatedAppUser(request);
    if (authResult.ok === false) {
      return authResult.response;
    }
  }

  const requestedPage = parsePositiveInt(request.nextUrl.searchParams.get('page'), DEFAULT_PAGE);
  const requestedPageSize = Math.min(
    parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const minBedroomsFilter = parsePositiveInt(request.nextUrl.searchParams.get('minBedrooms'), 0);
  const minimumPrice = parseNullableNumber(request.nextUrl.searchParams.get('minPrice'));
  const maximumPrice = parseNullableNumber(request.nextUrl.searchParams.get('maxPrice'));
  const [effectiveMinPrice, effectiveMaxPrice] =
    minimumPrice !== null && maximumPrice !== null && minimumPrice > maximumPrice
      ? [maximumPrice, minimumPrice]
      : [minimumPrice, maximumPrice];

  try {
    const supabase = getSupabaseServerClient();
    const listingsResult = await supabase
      .from('listings')
      .select(
        'id, property_id, created_by_user_id, title, description, weekly_rent, available_from, status, published_at',
      )
      .eq('status', 'PUBLISHED')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(MAX_LISTINGS_SCAN);

    if (listingsResult.error) {
      throw new Error(`query listings failed: ${listingsResult.error.message}`);
    }

    const listings = (listingsResult.data ?? []) as ListingRow[];
    if (listings.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          listings: [],
          pagination: {
            page: DEFAULT_PAGE,
            pageSize: requestedPageSize,
            total: 0,
            totalPages: 0,
            hasPrev: false,
            hasNext: false,
          },
        },
      });
    }

    const propertyIds = Array.from(new Set(listings.map((item) => item.property_id)));
    const landlordIds = Array.from(new Set(listings.map((item) => item.created_by_user_id)));

    const [propertiesResult, landlordsResult] = await Promise.all([
      supabase
        .from('properties')
        .select(
          'id, address_line_1, suburb, state, postcode, bedrooms, bathrooms, parking_spaces, pet_friendly, property_type',
        )
        .in('id', propertyIds),
      supabase.from('users').select('id, full_name, email').in('id', landlordIds),
    ]);
    const mediaResult = await supabase
      .from('property_media')
      .select('property_id, media_url, is_cover, sort_order, created_at')
      .in('property_id', propertyIds)
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (propertiesResult.error) {
      throw new Error(`query properties failed: ${propertiesResult.error.message}`);
    }

    if (landlordsResult.error) {
      throw new Error(`query landlords failed: ${landlordsResult.error.message}`);
    }
    if (mediaResult.error) {
      throw new Error(`query property media failed: ${mediaResult.error.message}`);
    }

    const propertiesById = new Map<string, PropertyRow>();
    (propertiesResult.data ?? []).forEach((row) => {
      propertiesById.set(String(row.id), row as PropertyRow);
    });

    const landlordsById = new Map<string, LandlordRow>();
    (landlordsResult.data ?? []).forEach((row) => {
      landlordsById.set(String(row.id), row as LandlordRow);
    });

    const coverImageByPropertyId = new Map<string, string>();
    (mediaResult.data ?? []).forEach((row) => {
      const media = row as PropertyMediaRow;
      if (!coverImageByPropertyId.has(media.property_id) && media.media_url) {
        coverImageByPropertyId.set(media.property_id, media.media_url);
      }
    });

    const normalized = listings
      .map((listing) => {
        const property = propertiesById.get(listing.property_id);
        if (!property) {
          return null;
        }

        const landlord = landlordsById.get(listing.created_by_user_id);
        const landlordName = landlord?.full_name?.trim() || landlord?.email || 'Landlord';

        return {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          weeklyRent: Number(listing.weekly_rent),
          availableFrom: listing.available_from,
          suburb: property.suburb,
          state: property.state,
          postcode: property.postcode,
          addressLine1: property.address_line_1,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          parkingSpaces: property.parking_spaces,
          propertyType: property.property_type,
          petFriendly: Boolean(property.pet_friendly),
          landlordName,
          publishedAt: listing.published_at,
          coverImageUrl: coverImageByPropertyId.get(listing.property_id) ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const filtered = normalized.filter((item) => {
      if (propertyTypeFilter && propertyTypeFilter !== 'ALL' && item.propertyType !== propertyTypeFilter) {
        return false;
      }

      if (typeof minBedroomsFilter === 'number' && minBedroomsFilter > 0) {
        if (typeof item.bedrooms !== 'number' || item.bedrooms < minBedroomsFilter) {
          return false;
        }
      }

      if (effectiveMinPrice !== null && item.weeklyRent < effectiveMinPrice) {
        return false;
      }

      if (effectiveMaxPrice !== null && item.weeklyRent > effectiveMaxPrice) {
        return false;
      }

      if (locationFilter) {
        const locationHaystack = [item.addressLine1, item.suburb, item.state, item.postcode]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .join(' ')
          .toLowerCase();

        if (!locationHaystack.includes(locationFilter)) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const haystack = [
        item.title,
        item.description,
        item.addressLine1,
        item.suburb,
        item.state,
        item.postcode,
        item.landlordName,
      ]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / requestedPageSize);
    const page = totalPages === 0 ? DEFAULT_PAGE : Math.min(requestedPage, totalPages);
    const offset = (page - 1) * requestedPageSize;
    const paginated = filtered.slice(offset, offset + requestedPageSize);

    return NextResponse.json({
      ok: true,
      data: {
        listings: paginated,
        pagination: {
          page,
          pageSize: requestedPageSize,
          total,
          totalPages,
          hasPrev: totalPages > 0 && page > 1,
          hasNext: totalPages > 0 && page < totalPages,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load listings.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
