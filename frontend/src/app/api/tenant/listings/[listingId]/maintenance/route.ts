import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedAppUser } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

const ALLOWED_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

type MaintenancePayload = {
  category: string;
  severity: (typeof ALLOWED_SEVERITIES)[number];
  description: string;
};

function sanitizeCategory(raw: unknown) {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 64).toUpperCase();
}

function parsePayload(
  raw: Record<string, unknown>,
): { ok: true; data: MaintenancePayload } | { ok: false; message: string } {
  const category = sanitizeCategory(raw.category);
  if (!category) {
    return { ok: false, message: 'category is required.' };
  }

  if (
    typeof raw.severity !== 'string' ||
    !ALLOWED_SEVERITIES.includes(raw.severity as (typeof ALLOWED_SEVERITIES)[number])
  ) {
    return { ok: false, message: 'severity is invalid.' };
  }

  if (typeof raw.description !== 'string' || raw.description.trim().length < 5) {
    return { ok: false, message: 'description must be at least 5 characters.' };
  }

  return {
    ok: true,
    data: {
      category,
      severity: raw.severity as (typeof ALLOWED_SEVERITIES)[number],
      description: raw.description.trim().slice(0, 2000),
    },
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ listingId: string }> },
) {
  const authResult = await resolveAuthenticatedAppUser(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  if (authResult.data.primaryRole !== 'TENANT') {
    return NextResponse.json(
      { ok: false, message: 'Only tenant accounts can submit maintenance requests.' },
      { status: 403 },
    );
  }

  const params = await context.params;
  const listingId = params.listingId?.trim();
  if (!listingId) {
    return NextResponse.json({ ok: false, message: 'listingId is required.' }, { status: 400 });
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const payloadResult = parsePayload(bodyResult.data);
  if (payloadResult.ok === false) {
    return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  try {
    const listingResult = await supabase
      .from('listings')
      .select('id, property_id, created_by_user_id')
      .eq('id', listingId)
      .maybeSingle();

    if (listingResult.error || !listingResult.data) {
      return NextResponse.json({ ok: false, message: 'Listing not found.' }, { status: 404 });
    }

    const approvedApplicationResult = await supabase
      .from('rental_applications')
      .select('id')
      .eq('listing_id', listingId)
      .eq('applicant_user_id', authResult.data.id)
      .eq('status', 'APPROVED')
      .maybeSingle();

    if (approvedApplicationResult.error) {
      throw new Error(`query approved application failed: ${approvedApplicationResult.error.message}`);
    }

    if (!approvedApplicationResult.data) {
      return NextResponse.json(
        { ok: false, message: 'Maintenance request is available only during approved tenancy.' },
        { status: 403 },
      );
    }

    const complaintId = crypto.randomUUID();
    const insertResult = await supabase.from('complaints').insert({
      id: complaintId,
      reporter_user_id: authResult.data.id,
      against_user_id: listingResult.data.created_by_user_id,
      property_id: listingResult.data.property_id,
      category: payloadResult.data.category,
      description: payloadResult.data.description,
      severity: payloadResult.data.severity,
      status: 'OPEN',
      lodged_at: nowIso,
      resolved_at: null,
      metadata: {
        listingId,
        source: 'tenant_listing_maintenance',
        createdByRole: authResult.data.primaryRole,
      },
    });

    if (insertResult.error) {
      throw new Error(`create maintenance request failed: ${insertResult.error.message}`);
    }

    return NextResponse.json({
      ok: true,
      message: 'Maintenance request submitted.',
      data: {
        complaintId,
        status: 'OPEN',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit maintenance request.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
