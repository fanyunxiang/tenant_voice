type ApplicationsApiResult<TData = unknown> = {
  ok: boolean;
  message?: string;
  data?: TData;
};

export type ApplicationSummary = {
  submittedCount: number;
  underReviewCount: number;
  shortlistedCount: number;
  approvedCount: number;
  rejectedCount: number;
};

export type LandlordApplicationDocument = {
  id: string;
  documentType: string | null;
  label: string;
  isVerified: boolean;
  url: string | null;
  updatedAt: string;
};

export type LandlordApplicationItem = {
  id: string;
  status: string;
  submittedAt: string;
  lastStatusAt: string;
  offerWeeklyRent: number | null;
  message: string | null;
  listing: {
    id: string;
    title: string;
    status: string;
    weeklyRent: number;
    availableFrom: string | null;
  } | null;
  property: {
    id: string;
    addressLine1: string;
    suburb: string;
    state: string;
    postcode: string;
    propertyType: string;
    bedrooms: number | null;
    bathrooms: number | null;
  } | null;
  applicant: {
    id: string;
    name: string;
    email: string;
  };
  documents: LandlordApplicationDocument[];
};

export type TenantApplicationItem = {
  id: string;
  listingId: string;
  status: string;
  submittedAt: string;
  lastStatusAt: string;
  offerWeeklyRent: number | null;
  message: string | null;
  listing: {
    title: string;
    status: string;
    weeklyRent: number;
    availableFrom: string | null;
  } | null;
  property: {
    addressLine1: string;
    suburb: string;
    state: string;
    postcode: string;
    propertyType: string;
    bedrooms: number | null;
    bathrooms: number | null;
  } | null;
};

export type LandlordApplicationsData = {
  role: 'LANDLORD';
  summary: ApplicationSummary;
  applications: LandlordApplicationItem[];
};

export type TenantApplicationsData = {
  role: 'TENANT';
  summary: ApplicationSummary;
  activeApplications: TenantApplicationItem[];
  historyApplications: TenantApplicationItem[];
};

export type ApplicationsData = LandlordApplicationsData | TenantApplicationsData;

const REQUEST_TIMEOUT_MS = 20000;

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

async function parseResult<TData>(response: Response): Promise<ApplicationsApiResult<TData>> {
  let body: ApplicationsApiResult<TData> | null = null;
  try {
    body = (await response.json()) as ApplicationsApiResult<TData>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.message || 'Request failed.');
  }

  return body ?? { ok: true };
}

async function requestApplications<TData>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApplicationsApiResult<TData>> {
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

export async function loadApplications() {
  return requestApplications<ApplicationsData>('/api/applications', {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function setApplicationStatus(payload: {
  applicationId: string;
  status: 'UNDER_REVIEW' | 'SHORTLISTED' | 'APPROVED' | 'REJECTED';
  note?: string;
}) {
  return requestApplications<{ applicationId: string; status: string; updatedAt: string }>('/api/applications', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'setStatus',
      applicationId: payload.applicationId,
      status: payload.status,
      note: payload.note ?? '',
    }),
  });
}
