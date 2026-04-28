import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedAppUser } from 'lib/landlord/authServer';

type AddressSuggestion = {
  id: string;
  label: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
};

type GeoapifyAutocompleteFeature = {
  properties?: {
    place_id?: string | number;
    formatted?: string;
    country_code?: string;
    housenumber?: string;
    street?: string;
    address_line1?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    state_code?: string;
    postcode?: string;
  };
};

type GeoapifyAutocompleteResponse = {
  features?: GeoapifyAutocompleteFeature[];
};

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 180;
const RESULT_LIMIT = 8;

export async function GET(request: NextRequest) {
  const authResult = await resolveAuthenticatedAppUser(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const textRaw = request.nextUrl.searchParams.get('text') ?? '';
  const text = textRaw.trim();

  if (!text || text.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ ok: true, data: { suggestions: [] } });
  }

  if (text.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { ok: false, message: `text must be <= ${MAX_QUERY_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const geoapifyApiKey =
    process.env.GEOAPIFY_API_KEY || process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || '';

  if (!geoapifyApiKey) {
    return NextResponse.json(
      { ok: false, message: 'GEOAPIFY_API_KEY is not configured.' },
      { status: 500 },
    );
  }

  try {
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', text);
    url.searchParams.set('filter', 'countrycode:au');
    url.searchParams.set('limit', String(RESULT_LIMIT));
    url.searchParams.set('apiKey', geoapifyApiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Geoapify autocomplete failed with status ${response.status}.`,
        },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as GeoapifyAutocompleteResponse;
    const suggestions = (payload.features ?? [])
      .map((feature, index) => toAddressSuggestion(feature, index))
      .filter((item): item is AddressSuggestion => Boolean(item));

    return NextResponse.json({ ok: true, data: { suggestions } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load address suggestions.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

function toAddressSuggestion(
  feature: GeoapifyAutocompleteFeature,
  index: number,
): AddressSuggestion | null {
  const props = feature.properties ?? {};
  const countryCode = normalizeString(props.country_code)?.toLowerCase() ?? '';
  if (countryCode && countryCode !== 'au') {
    return null;
  }

  const houseNumber = normalizeString(props.housenumber) ?? '';
  const street = normalizeString(props.street) ?? '';
  let addressLine1 = `${houseNumber} ${street}`.trim();
  if (!addressLine1) {
    addressLine1 = normalizeString(props.address_line1) ?? '';
  }

  const suburb =
    normalizeString(props.suburb) ??
    normalizeString(props.city) ??
    normalizeString(props.town) ??
    normalizeString(props.village) ??
    '';

  const state = (
    normalizeString(props.state_code) ??
    normalizeString(props.state) ??
    ''
  ).toUpperCase();
  const postcode = normalizeString(props.postcode) ?? '';

  const label =
    normalizeString(props.formatted) ??
    [addressLine1, suburb, state, postcode, 'Australia'].filter(Boolean).join(', ');

  if (!label) {
    return null;
  }

  const id = String(props.place_id ?? `${label}-${index}`);

  return {
    id,
    label,
    addressLine1,
    suburb,
    state,
    postcode,
  };
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

