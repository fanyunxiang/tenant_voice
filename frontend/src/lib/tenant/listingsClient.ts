import { handleExpiredSessionResponse, sessionExpiredError } from 'lib/auth/handleExpiredSessionClient';

type ListingsApiResult<TData = unknown> = {
  ok: boolean;
  message?: string;
  data?: TData;
};

export type TenantListingItem = {
  id: string;
  title: string;
  description: string | null;
  weeklyRent: number;
  availableFrom: string | null;
  suburb: string;
  state: string;
  postcode: string;
  addressLine1: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  propertyType: string;
  petFriendly: boolean;
  landlordName: string;
  publishedAt: string | null;
  coverImageUrl?: string | null;
};

export type TenantListingsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type TenantListingsResponseData = {
  listings: TenantListingItem[];
  pagination: TenantListingsPagination;
};

const REQUEST_TIMEOUT_MS = 15000;

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

async function parseResult<TData>(response: Response): Promise<ListingsApiResult<TData>> {
  let body: ListingsApiResult<TData> | null = null;

  try {
    body = (await response.json()) as ListingsApiResult<TData>;
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

async function requestListings<TData>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ListingsApiResult<TData>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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

export async function loadTenantListings(payload?: {
  q?: string;
  location?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();

  if (payload?.q && payload.q.trim()) {
    params.set('q', payload.q.trim());
  }

  if (payload?.location && payload.location.trim()) {
    params.set('location', payload.location.trim());
  }

  if (payload?.propertyType && payload.propertyType.trim()) {
    params.set('propertyType', payload.propertyType.trim());
  }

  if (typeof payload?.minPrice === 'number' && Number.isFinite(payload.minPrice) && payload.minPrice >= 0) {
    params.set('minPrice', String(payload.minPrice));
  }

  if (typeof payload?.maxPrice === 'number' && Number.isFinite(payload.maxPrice) && payload.maxPrice >= 0) {
    params.set('maxPrice', String(payload.maxPrice));
  }

  if (
    typeof payload?.minBedrooms === 'number' &&
    Number.isFinite(payload.minBedrooms) &&
    payload.minBedrooms >= 1
  ) {
    params.set('minBedrooms', String(payload.minBedrooms));
  }

  if (typeof payload?.page === 'number' && Number.isFinite(payload.page) && payload.page >= 1) {
    params.set('page', String(Math.floor(payload.page)));
  }

  if (typeof payload?.pageSize === 'number' && Number.isFinite(payload.pageSize) && payload.pageSize >= 1) {
    params.set('pageSize', String(Math.floor(payload.pageSize)));
  }

  const query = params.toString();
  const endpoint = query ? `/api/tenant/listings?${query}` : '/api/tenant/listings';

  return requestListings<TenantListingsResponseData>(endpoint, {
    method: 'GET',
    cache: 'no-store',
  });
}
