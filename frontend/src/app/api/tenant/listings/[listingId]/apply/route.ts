import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedAppUser } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

type ApplyPayload = {
  message: string | null;
  offerWeeklyRent: number | null;
};

function parsePayload(raw: Record<string, unknown>): { ok: true; data: ApplyPayload } | { ok: false; message: string } {
  const messageRaw = typeof raw.message === 'string' ? raw.message.trim() : '';
  const offerRaw = raw.offerWeeklyRent;
  const offerWeeklyRent =
    typeof offerRaw === 'number' && Number.isFinite(offerRaw) && offerRaw > 0 ? offerRaw : null;

  if (messageRaw.length > 2000) {
    return { ok: false, message: 'Message is too long. Maximum is 2000 characters.' };
  }

  return {
    ok: true,
    data: {
      message: messageRaw.length > 0 ? messageRaw : null,
      offerWeeklyRent,
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
      { ok: false, message: 'Only tenant accounts can submit rental applications.' },
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
      .select('id, created_by_user_id, status')
      .eq('id', listingId)
      .maybeSingle();

    if (listingResult.error) {
      throw new Error(`query listing failed: ${listingResult.error.message}`);
    }

    if (!listingResult.data) {
      return NextResponse.json({ ok: false, message: 'Listing not found.' }, { status: 404 });
    }

    if (listingResult.data.status !== 'PUBLISHED') {
      return NextResponse.json(
        { ok: false, message: 'This listing is not open for applications.' },
        { status: 400 },
      );
    }

    if (listingResult.data.created_by_user_id === authResult.data.id) {
      return NextResponse.json(
        { ok: false, message: 'You cannot apply to your own listing.' },
        { status: 400 },
      );
    }

    const existingResult = await supabase
      .from('rental_applications')
      .select('id, status')
      .eq('listing_id', listingId)
      .eq('applicant_user_id', authResult.data.id)
      .maybeSingle();

    if (existingResult.error) {
      throw new Error(`query existing application failed: ${existingResult.error.message}`);
    }

    if (existingResult.data) {
      const existingStatus = String(existingResult.data.status || '').toUpperCase();
      const editableStatuses = new Set(['REJECTED', 'WITHDRAWN', 'EXPIRED']);

      if (!editableStatuses.has(existingStatus)) {
        return NextResponse.json({
          ok: true,
          message: `Application already exists with status ${existingStatus}.`,
          data: {
            applicationId: existingResult.data.id,
            status: existingStatus,
            alreadyExists: true,
          },
        });
      }

      const updateResult = await supabase
        .from('rental_applications')
        .update({
          status: 'SUBMITTED',
          offer_weekly_rent: payloadResult.data.offerWeeklyRent,
          message: payloadResult.data.message,
          metadata: {
            source: 'listing_detail_apply',
            resubmittedAt: nowIso,
          },
          submitted_at: nowIso,
          last_status_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', existingResult.data.id)
        .select('id, status')
        .single();

      if (updateResult.error || !updateResult.data) {
        throw new Error(`resubmit application failed: ${updateResult.error?.message || 'unknown error'}`);
      }

      return NextResponse.json({
        ok: true,
        message: 'Application resubmitted.',
        data: {
          applicationId: updateResult.data.id,
          status: updateResult.data.status,
          alreadyExists: false,
        },
      });
    }

    const applicationId = crypto.randomUUID();
    const insertResult = await supabase
      .from('rental_applications')
      .insert({
        id: applicationId,
        listing_id: listingId,
        applicant_user_id: authResult.data.id,
        status: 'SUBMITTED',
        offer_weekly_rent: payloadResult.data.offerWeeklyRent,
        message: payloadResult.data.message,
        metadata: {
          source: 'listing_detail_apply',
          submittedByRole: authResult.data.primaryRole,
        },
        submitted_at: nowIso,
        last_status_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id, status')
      .single();

    if (insertResult.error || !insertResult.data) {
      throw new Error(`create application failed: ${insertResult.error?.message || 'unknown error'}`);
    }

    return NextResponse.json({
      ok: true,
      message: 'Application submitted successfully.',
      data: {
        applicationId: insertResult.data.id,
        status: insertResult.data.status,
        alreadyExists: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit application.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
