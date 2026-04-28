type ListingDetailApiResult<TData = unknown> = {
  ok: boolean;
  message?: string;
  data?: TData;
};

export type ListingReviewItem = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerifiedInteraction: boolean;
  createdAt: string;
  reviewerName: string;
};

export type TenantListingDetailData = {
  viewerRole: string;
  listing: {
    id: string;
    title: string;
    description: string | null;
    weeklyRent: number;
    bondAmount: number | null;
    availableFrom: string | null;
    leaseTermMonths: number | null;
    status: string;
    publishedAt: string | null;
  };
  property: {
    id: string;
    propertyType: string;
    addressLine1: string;
    addressLine2: string | null;
    suburb: string;
    state: string;
    postcode: string;
    country: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    parkingSpaces: number | null;
    petFriendly: boolean;
  };
  landlord: {
    id: string;
    name: string;
    email: string;
  };
  rentalInsight: {
    totalApplications: number;
    submittedCount: number;
    underReviewCount: number;
    shortlistedCount: number;
    approvedCount: number;
    leasedCount: number;
    listingStatus: string;
    myApplication: {
      id: string;
      status: string;
      submittedAt: string | null;
      lastStatusAt: string | null;
    } | null;
  };
  actions: {
    canReview: boolean;
    canRequestMaintenance: boolean;
    myOpenMaintenanceCount: number;
    myReview: {
      id: string;
      rating: number;
      title: string | null;
      body: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
  reviews: {
    property: {
      averageRating: number | null;
      totalCount: number;
      recent: ListingReviewItem[];
    };
    landlord: {
      averageRating: number | null;
      totalCount: number;
      recent: ListingReviewItem[];
    };
  };
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

async function parseResult<TData>(response: Response): Promise<ListingDetailApiResult<TData>> {
  let body: ListingDetailApiResult<TData> | null = null;
  try {
    body = (await response.json()) as ListingDetailApiResult<TData>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.message || 'Request failed.');
  }

  return body ?? { ok: true };
}

async function requestListingDetail<TData>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ListingDetailApiResult<TData>> {
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

export async function loadTenantListingDetail(listingId: string) {
  return requestListingDetail<TenantListingDetailData>(`/api/tenant/listings/${listingId}`, {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function applyTenantListing(payload: {
  listingId: string;
  message?: string;
  offerWeeklyRent?: number | null;
}) {
  return requestListingDetail<{ applicationId: string; status: string; alreadyExists: boolean }>(
    `/api/tenant/listings/${payload.listingId}/apply`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: payload.message ?? '',
        offerWeeklyRent: payload.offerWeeklyRent ?? null,
      }),
    },
  );
}

export async function contactListingLandlord(payload: { listingId: string; content?: string }) {
  return requestListingDetail<{ conversationId: string; messageId: string | null }>(
    `/api/tenant/listings/${payload.listingId}/contact`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: payload.content ?? '',
      }),
    },
  );
}

export async function submitTenantListingReview(payload: {
  listingId: string;
  rating: number;
  title?: string;
  body?: string;
}) {
  return requestListingDetail<{ reviewId: string; rating: number }>(
    `/api/tenant/listings/${payload.listingId}/review`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rating: payload.rating,
        title: payload.title ?? '',
        body: payload.body ?? '',
      }),
    },
  );
}

export async function createTenantMaintenanceRequest(payload: {
  listingId: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}) {
  return requestListingDetail<{ complaintId: string; status: string }>(
    `/api/tenant/listings/${payload.listingId}/maintenance`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category: payload.category,
        severity: payload.severity,
        description: payload.description,
      }),
    },
  );
}
