import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedAppUser } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

const PROFILE_DOCUMENTS_BUCKET = process.env.SUPABASE_PROFILE_DOCUMENTS_BUCKET ?? 'profile-documents';
const LANDLORD_REVIEWABLE_STATUSES = ['UNDER_REVIEW', 'SHORTLISTED', 'APPROVED', 'REJECTED'] as const;
const TENANT_ACTIVE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'] as const;
const TENANT_HISTORY_STATUSES = ['APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'] as const;

type ListingRow = {
  id: string;
  property_id: string;
  title: string;
  status: string;
  weekly_rent: number | string;
  available_from: string | null;
};

type PropertyRow = {
  id: string;
  address_line_1: string;
  suburb: string;
  state: string;
  postcode: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
};

type RentalApplicationRow = {
  id: string;
  listing_id: string;
  applicant_user_id: string;
  status: string;
  offer_weekly_rent: number | string | null;
  message: string | null;
  submitted_at: string;
  last_status_at: string;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string;
};

type ProfileDocumentRow = {
  id: string;
  user_id: string;
  document_type: string | null;
  file_url: string | null;
  is_verified: boolean | null;
  metadata: unknown;
  updated_at: string;
};

type PatchPayload = {
  action: 'setStatus';
  applicationId: string;
  status: (typeof LANDLORD_REVIEWABLE_STATUSES)[number];
  note: string | null;
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function parsePatchPayload(
  raw: Record<string, unknown>,
): { ok: true; data: PatchPayload } | { ok: false; message: string } {
  if (raw.action !== 'setStatus') {
    return { ok: false, message: 'Unsupported action for PATCH. Use action=setStatus.' };
  }

  if (typeof raw.applicationId !== 'string' || raw.applicationId.trim().length === 0) {
    return { ok: false, message: 'applicationId is required.' };
  }

  if (
    typeof raw.status !== 'string' ||
    !LANDLORD_REVIEWABLE_STATUSES.includes(raw.status as (typeof LANDLORD_REVIEWABLE_STATUSES)[number])
  ) {
    return { ok: false, message: 'status is invalid.' };
  }

  return {
    ok: true,
    data: {
      action: 'setStatus',
      applicationId: raw.applicationId.trim(),
      status: raw.status as (typeof LANDLORD_REVIEWABLE_STATUSES)[number],
      note: normalizeText(raw.note, 1200),
    },
  };
}

function formatDocumentLabel(documentType: string | null) {
  if (!documentType) {
    return 'Document';
  }

  return documentType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function buildSignedDocumentUrl(document: ProfileDocumentRow) {
  if (!document.file_url) {
    return null;
  }

  const rawPath = document.file_url.trim();
  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
    return rawPath;
  }

  const metadata = document.metadata as { storageBucket?: string } | null;
  const bucket = typeof metadata?.storageBucket === 'string' && metadata.storageBucket.trim()
    ? metadata.storageBucket.trim()
    : PROFILE_DOCUMENTS_BUCKET;

  const supabase = getSupabaseServerClient();
  const signedResult = await supabase.storage.from(bucket).createSignedUrl(rawPath, 60 * 60);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    return null;
  }

  return signedResult.data.signedUrl;
}

async function buildLandlordApplications(userId: string) {
  const supabase = getSupabaseServerClient();

  const propertiesResult = await supabase.from('properties').select('id').eq('owner_user_id', userId);
  if (propertiesResult.error) {
    throw new Error(`query properties failed: ${propertiesResult.error.message}`);
  }

  const propertyIds = (propertiesResult.data ?? []).map((item) => String(item.id));
  if (propertyIds.length === 0) {
    return {
      role: 'LANDLORD',
      summary: {
        submittedCount: 0,
        underReviewCount: 0,
        shortlistedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      },
      applications: [],
    };
  }

  const listingsResult = await supabase
    .from('listings')
    .select('id, property_id, title, status, weekly_rent, available_from')
    .in('property_id', propertyIds);

  if (listingsResult.error) {
    throw new Error(`query listings failed: ${listingsResult.error.message}`);
  }

  const listings = (listingsResult.data ?? []) as ListingRow[];
  const listingIds = listings.map((item) => item.id);
  if (listingIds.length === 0) {
    return {
      role: 'LANDLORD',
      summary: {
        submittedCount: 0,
        underReviewCount: 0,
        shortlistedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      },
      applications: [],
    };
  }

  const [propertiesDetailResult, applicationsResult] = await Promise.all([
    supabase
      .from('properties')
      .select('id, address_line_1, suburb, state, postcode, property_type, bedrooms, bathrooms')
      .in('id', propertyIds),
    supabase
      .from('rental_applications')
      .select('id, listing_id, applicant_user_id, status, offer_weekly_rent, message, submitted_at, last_status_at')
      .in('listing_id', listingIds)
      .order('submitted_at', { ascending: false }),
  ]);

  if (propertiesDetailResult.error) {
    throw new Error(`query property details failed: ${propertiesDetailResult.error.message}`);
  }
  if (applicationsResult.error) {
    throw new Error(`query applications failed: ${applicationsResult.error.message}`);
  }

  const propertiesById = new Map<string, PropertyRow>();
  ((propertiesDetailResult.data ?? []) as PropertyRow[]).forEach((property) => {
    propertiesById.set(property.id, property);
  });

  const listingsById = new Map<string, ListingRow>();
  listings.forEach((listing) => {
    listingsById.set(listing.id, listing);
  });

  const applications = (applicationsResult.data ?? []) as RentalApplicationRow[];
  const applicantIds = Array.from(new Set(applications.map((item) => item.applicant_user_id)));

  const [usersResult, profileDocumentsResult] = await Promise.all([
    applicantIds.length > 0
      ? supabase.from('users').select('id, full_name, email').in('id', applicantIds)
      : Promise.resolve({ data: [], error: null }),
    applicantIds.length > 0
      ? supabase
          .from('profile_documents')
          .select('id, user_id, document_type, file_url, is_verified, metadata, updated_at')
          .in('user_id', applicantIds)
          .not('file_url', 'is', null)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (usersResult.error) {
    throw new Error(`query applicants failed: ${usersResult.error.message}`);
  }
  if (profileDocumentsResult.error) {
    throw new Error(`query applicant documents failed: ${profileDocumentsResult.error.message}`);
  }

  const usersById = new Map<string, UserRow>();
  ((usersResult.data ?? []) as UserRow[]).forEach((user) => {
    usersById.set(user.id, user);
  });

  const profileDocuments = (profileDocumentsResult.data ?? []) as ProfileDocumentRow[];
  const signedDocuments = await Promise.all(
    profileDocuments.map(async (document) => ({
      ...document,
      signedUrl: await buildSignedDocumentUrl(document),
    })),
  );

  const documentsByUser = new Map<
    string,
    Array<{
      id: string;
      documentType: string | null;
      label: string;
      isVerified: boolean;
      url: string | null;
      updatedAt: string;
    }>
  >();

  signedDocuments.forEach((document) => {
    const existing = documentsByUser.get(document.user_id) ?? [];
    existing.push({
      id: document.id,
      documentType: document.document_type,
      label: formatDocumentLabel(document.document_type),
      isVerified: Boolean(document.is_verified),
      url: document.signedUrl,
      updatedAt: document.updated_at,
    });
    documentsByUser.set(document.user_id, existing);
  });

  const summary = {
    submittedCount: applications.filter((item) => item.status === 'SUBMITTED').length,
    underReviewCount: applications.filter((item) => item.status === 'UNDER_REVIEW').length,
    shortlistedCount: applications.filter((item) => item.status === 'SHORTLISTED').length,
    approvedCount: applications.filter((item) => item.status === 'APPROVED').length,
    rejectedCount: applications.filter((item) => item.status === 'REJECTED').length,
  };

  return {
    role: 'LANDLORD' as const,
    summary,
    applications: applications.map((application) => {
      const listing = listingsById.get(application.listing_id) ?? null;
      const property = listing ? propertiesById.get(listing.property_id) ?? null : null;
      const applicant = usersById.get(application.applicant_user_id) ?? null;

      return {
        id: application.id,
        status: application.status,
        submittedAt: application.submitted_at,
        lastStatusAt: application.last_status_at,
        offerWeeklyRent:
          application.offer_weekly_rent === null ? null : Number(application.offer_weekly_rent),
        message: application.message,
        listing: listing
          ? {
              id: listing.id,
              title: listing.title,
              status: listing.status,
              weeklyRent: Number(listing.weekly_rent),
              availableFrom: listing.available_from,
            }
          : null,
        property: property
          ? {
              id: property.id,
              addressLine1: property.address_line_1,
              suburb: property.suburb,
              state: property.state,
              postcode: property.postcode,
              propertyType: property.property_type,
              bedrooms: property.bedrooms,
              bathrooms: property.bathrooms,
            }
          : null,
        applicant: applicant
          ? {
              id: applicant.id,
              name: applicant.full_name?.trim() || applicant.email,
              email: applicant.email,
            }
          : {
              id: application.applicant_user_id,
              name: 'Unknown applicant',
              email: '',
            },
        documents: (documentsByUser.get(application.applicant_user_id) ?? []).filter((item) => item.url),
      };
    }),
  };
}

async function buildTenantApplications(userId: string) {
  const supabase = getSupabaseServerClient();

  const applicationsResult = await supabase
    .from('rental_applications')
    .select('id, listing_id, applicant_user_id, status, offer_weekly_rent, message, submitted_at, last_status_at')
    .eq('applicant_user_id', userId)
    .order('submitted_at', { ascending: false });

  if (applicationsResult.error) {
    throw new Error(`query applications failed: ${applicationsResult.error.message}`);
  }

  const applications = (applicationsResult.data ?? []) as RentalApplicationRow[];
  const listingIds = Array.from(new Set(applications.map((item) => item.listing_id)));

  if (listingIds.length === 0) {
    return {
      role: 'TENANT',
      summary: {
        submittedCount: 0,
        underReviewCount: 0,
        shortlistedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      },
      activeApplications: [],
      historyApplications: [],
    };
  }

  const listingsResult = await supabase
    .from('listings')
    .select('id, property_id, title, status, weekly_rent, available_from')
    .in('id', listingIds);

  if (listingsResult.error) {
    throw new Error(`query listings failed: ${listingsResult.error.message}`);
  }

  const listings = (listingsResult.data ?? []) as ListingRow[];
  const listingById = new Map<string, ListingRow>();
  listings.forEach((listing) => {
    listingById.set(listing.id, listing);
  });

  const propertyIds = Array.from(new Set(listings.map((item) => item.property_id)));
  const propertiesResult = propertyIds.length
    ? await supabase
        .from('properties')
        .select('id, address_line_1, suburb, state, postcode, property_type, bedrooms, bathrooms')
        .in('id', propertyIds)
    : { data: [], error: null };

  if (propertiesResult.error) {
    throw new Error(`query properties failed: ${propertiesResult.error.message}`);
  }

  const propertiesById = new Map<string, PropertyRow>();
  ((propertiesResult.data ?? []) as PropertyRow[]).forEach((property) => {
    propertiesById.set(property.id, property);
  });

  const summary = {
    submittedCount: applications.filter((item) => item.status === 'SUBMITTED').length,
    underReviewCount: applications.filter((item) => item.status === 'UNDER_REVIEW').length,
    shortlistedCount: applications.filter((item) => item.status === 'SHORTLISTED').length,
    approvedCount: applications.filter((item) => item.status === 'APPROVED').length,
    rejectedCount: applications.filter((item) => item.status === 'REJECTED').length,
  };

  const mapped = applications.map((application) => {
    const listing = listingById.get(application.listing_id) ?? null;
    const property = listing ? propertiesById.get(listing.property_id) ?? null : null;

    return {
      id: application.id,
      listingId: application.listing_id,
      status: application.status,
      submittedAt: application.submitted_at,
      lastStatusAt: application.last_status_at,
      offerWeeklyRent: application.offer_weekly_rent === null ? null : Number(application.offer_weekly_rent),
      message: application.message,
      listing: listing
        ? {
            title: listing.title,
            status: listing.status,
            weeklyRent: Number(listing.weekly_rent),
            availableFrom: listing.available_from,
          }
        : null,
      property: property
        ? {
            addressLine1: property.address_line_1,
            suburb: property.suburb,
            state: property.state,
            postcode: property.postcode,
            propertyType: property.property_type,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
          }
        : null,
    };
  });

  const activeSet = new Set(TENANT_ACTIVE_STATUSES);
  const historySet = new Set(TENANT_HISTORY_STATUSES);

  return {
    role: 'TENANT' as const,
    summary,
    activeApplications: mapped.filter((item) => activeSet.has(item.status as (typeof TENANT_ACTIVE_STATUSES)[number])),
    historyApplications: mapped.filter((item) =>
      historySet.has(item.status as (typeof TENANT_HISTORY_STATUSES)[number]),
    ),
  };
}

async function updateApplicationStatusForLandlord(userId: string, payload: PatchPayload) {
  const supabase = getSupabaseServerClient();

  const applicationResult = await supabase
    .from('rental_applications')
    .select('id, listing_id, status')
    .eq('id', payload.applicationId)
    .maybeSingle();

  if (applicationResult.error || !applicationResult.data) {
    return NextResponse.json({ ok: false, message: 'Application not found.' }, { status: 404 });
  }

  const listingResult = await supabase
    .from('listings')
    .select('id, property_id')
    .eq('id', applicationResult.data.listing_id)
    .maybeSingle();

  if (listingResult.error || !listingResult.data) {
    return NextResponse.json({ ok: false, message: 'Listing not found.' }, { status: 404 });
  }

  const ownerResult = await supabase
    .from('properties')
    .select('id')
    .eq('id', listingResult.data.property_id)
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (ownerResult.error || !ownerResult.data) {
    return NextResponse.json(
      { ok: false, message: 'You do not have permission to review this application.' },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();

  const updateResult = await supabase
    .from('rental_applications')
    .update({
      status: payload.status,
      last_status_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', payload.applicationId)
    .select('id, status')
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      { ok: false, message: updateResult.error?.message || 'Failed to update status.' },
      { status: 500 },
    );
  }

  const statusEventResult = await supabase.from('application_status_events').insert({
    id: crypto.randomUUID(),
    application_id: payload.applicationId,
    from_status: applicationResult.data.status,
    to_status: payload.status,
    note: payload.note,
    changed_by_user_id: userId,
    created_at: nowIso,
  });

  return NextResponse.json({
    ok: true,
    message:
      statusEventResult.error
        ? `Application updated to ${payload.status}, but status history log failed.`
        : `Application status updated to ${payload.status}.`,
    data: {
      applicationId: updateResult.data.id,
      status: updateResult.data.status,
      updatedAt: nowIso,
    },
  });
}

export async function GET(request: NextRequest) {
  const authResult = await resolveAuthenticatedAppUser(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  try {
    if (authResult.data.primaryRole === 'LANDLORD') {
      const data = await buildLandlordApplications(authResult.data.id);
      return NextResponse.json({ ok: true, data });
    }

    if (authResult.data.primaryRole === 'TENANT') {
      const data = await buildTenantApplications(authResult.data.id);
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json(
      { ok: false, message: 'Applications page supports tenant and landlord accounts only.' },
      { status: 403 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load applications.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await resolveAuthenticatedAppUser(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  if (authResult.data.primaryRole !== 'LANDLORD') {
    return NextResponse.json(
      { ok: false, message: 'Only landlord accounts can review applications.' },
      { status: 403 },
    );
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const payloadResult = parsePatchPayload(bodyResult.data);
  if (payloadResult.ok === false) {
    return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
  }

  return updateApplicationStatusForLandlord(authResult.data.id, payloadResult.data);
}
