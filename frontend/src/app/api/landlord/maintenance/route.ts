import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedLandlord } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

const ACTIVE_STATUSES = ['OPEN', 'IN_REVIEW', 'ESCALATED'] as const;

type ComplaintRow = {
  id: string;
  reporter_user_id: string;
  property_id: string | null;
  category: string;
  description: string;
  severity: string;
  status: string;
  lodged_at: string;
  resolved_at: string | null;
  metadata: unknown;
};

type PropertyRow = {
  id: string;
  address_line_1: string;
  suburb: string;
  state: string;
  postcode: string;
};

type ListingRow = {
  id: string;
  property_id: string;
  title: string;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string;
};

type AssignPayload = {
  action: 'assignWorker';
  complaintId: string;
  workerType: string;
  workerName: string;
};

function parseAssignPayload(
  raw: Record<string, unknown>,
): { ok: true; data: AssignPayload } | { ok: false; message: string } {
  if (raw.action !== 'assignWorker') {
    return { ok: false, message: 'Unsupported action for PATCH. Use action=assignWorker.' };
  }

  if (typeof raw.complaintId !== 'string' || raw.complaintId.trim().length === 0) {
    return { ok: false, message: 'complaintId is required.' };
  }
  if (typeof raw.workerType !== 'string' || raw.workerType.trim().length === 0) {
    return { ok: false, message: 'workerType is required.' };
  }
  if (typeof raw.workerName !== 'string' || raw.workerName.trim().length === 0) {
    return { ok: false, message: 'workerName is required.' };
  }

  return {
    ok: true,
    data: {
      action: 'assignWorker',
      complaintId: raw.complaintId.trim(),
      workerType: raw.workerType.trim().slice(0, 60),
      workerName: raw.workerName.trim().slice(0, 60),
    },
  };
}

async function buildMaintenanceRequests(landlordUserId: string) {
  const supabase = getSupabaseServerClient();

  const propertiesResult = await supabase
    .from('properties')
    .select('id, address_line_1, suburb, state, postcode')
    .eq('owner_user_id', landlordUserId);

  if (propertiesResult.error) {
    throw new Error(`query properties failed: ${propertiesResult.error.message}`);
  }

  const properties = (propertiesResult.data ?? []) as PropertyRow[];
  const propertyIds = properties.map((property) => property.id);
  if (propertyIds.length === 0) {
    return { requests: [] };
  }

  const [complaintsResult, listingsResult] = await Promise.all([
    supabase
      .from('complaints')
      .select('id, reporter_user_id, property_id, category, description, severity, status, lodged_at, resolved_at, metadata')
      .in('property_id', propertyIds)
      .in('status', [...ACTIVE_STATUSES])
      .order('lodged_at', { ascending: false }),
    supabase
      .from('listings')
      .select('id, property_id, title')
      .in('property_id', propertyIds)
      .order('updated_at', { ascending: false }),
  ]);

  if (complaintsResult.error) {
    throw new Error(`query complaints failed: ${complaintsResult.error.message}`);
  }
  if (listingsResult.error) {
    throw new Error(`query listings failed: ${listingsResult.error.message}`);
  }

  const complaints = (complaintsResult.data ?? []) as ComplaintRow[];
  const listings = (listingsResult.data ?? []) as ListingRow[];

  const listingByPropertyId = new Map<string, ListingRow>();
  listings.forEach((listing) => {
    if (!listingByPropertyId.has(listing.property_id)) {
      listingByPropertyId.set(listing.property_id, listing);
    }
  });

  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const reporterIds = Array.from(new Set(complaints.map((complaint) => complaint.reporter_user_id)));

  const usersResult = reporterIds.length
    ? await supabase.from('users').select('id, full_name, email').in('id', reporterIds)
    : { data: [], error: null };

  if (usersResult.error) {
    throw new Error(`query complaint reporters failed: ${usersResult.error.message}`);
  }

  const usersById = new Map<string, UserRow>();
  ((usersResult.data ?? []) as UserRow[]).forEach((user) => {
    usersById.set(user.id, user);
  });

  return {
    requests: complaints.map((complaint) => {
      const property = complaint.property_id ? propertyById.get(complaint.property_id) ?? null : null;
      const listing = complaint.property_id ? listingByPropertyId.get(complaint.property_id) ?? null : null;
      const reporter = usersById.get(complaint.reporter_user_id) ?? null;
      const metadata = complaint.metadata as
        | {
            assignedWorker?: {
              workerType?: string;
              workerName?: string;
              assignedAt?: string;
            };
          }
        | null;
      const assignedWorker = metadata?.assignedWorker;

      return {
        id: complaint.id,
        category: complaint.category,
        description: complaint.description,
        severity: complaint.severity,
        status: complaint.status,
        lodgedAt: complaint.lodged_at,
        resolvedAt: complaint.resolved_at,
        tenantName: reporter?.full_name?.trim() || reporter?.email || 'Tenant',
        tenantEmail: reporter?.email || '',
        listingId: listing?.id || null,
        listingTitle: listing?.title || 'Property maintenance request',
        property: property
          ? {
              addressLine1: property.address_line_1,
              suburb: property.suburb,
              state: property.state,
              postcode: property.postcode,
            }
          : null,
        assignedWorker:
          assignedWorker && assignedWorker.workerType && assignedWorker.workerName
            ? {
                workerType: assignedWorker.workerType,
                workerName: assignedWorker.workerName,
                assignedAt: assignedWorker.assignedAt || null,
              }
            : null,
      };
    }),
  };
}

async function assignWorker(landlordUserId: string, payload: AssignPayload) {
  const supabase = getSupabaseServerClient();

  const complaintResult = await supabase
    .from('complaints')
    .select('id, property_id, status, metadata')
    .eq('id', payload.complaintId)
    .maybeSingle();

  if (complaintResult.error || !complaintResult.data) {
    return NextResponse.json({ ok: false, message: 'Maintenance request not found.' }, { status: 404 });
  }

  const complaint = complaintResult.data as {
    id: string;
    property_id: string | null;
    status: string;
    metadata: unknown;
  };

  if (!complaint.property_id) {
    return NextResponse.json({ ok: false, message: 'Invalid maintenance request property.' }, { status: 400 });
  }

  const ownerResult = await supabase
    .from('properties')
    .select('id')
    .eq('id', complaint.property_id)
    .eq('owner_user_id', landlordUserId)
    .maybeSingle();

  if (ownerResult.error || !ownerResult.data) {
    return NextResponse.json(
      { ok: false, message: 'You do not have permission to assign this request.' },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();
  const existingMetadata = (complaint.metadata as Record<string, unknown> | null) ?? {};

  const updateResult = await supabase
    .from('complaints')
    .update({
      status: complaint.status === 'OPEN' ? 'IN_REVIEW' : complaint.status,
      metadata: {
        ...existingMetadata,
        assignedWorker: {
          workerType: payload.workerType,
          workerName: payload.workerName,
          assignedAt: nowIso,
        },
      },
    })
    .eq('id', complaint.id);

  if (updateResult.error) {
    return NextResponse.json(
      { ok: false, message: `Failed to assign worker: ${updateResult.error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Assigned ${payload.workerName} (${payload.workerType}).`,
    data: {
      complaintId: complaint.id,
      workerType: payload.workerType,
      workerName: payload.workerName,
      assignedAt: nowIso,
    },
  });
}

export async function GET(request: NextRequest) {
  const authResult = await resolveAuthenticatedLandlord(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  try {
    const data = await buildMaintenanceRequests(authResult.data.id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load maintenance requests.';
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

  const payloadResult = parseAssignPayload(bodyResult.data);
  if (payloadResult.ok === false) {
    return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
  }

  return assignWorker(authResult.data.id, payloadResult.data);
}
