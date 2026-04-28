import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedAppUser } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

type ReviewPayload = {
  rating: number;
  title: string | null;
  body: string | null;
};

function parsePayload(
  raw: Record<string, unknown>,
): { ok: true; data: ReviewPayload } | { ok: false; message: string } {
  const ratingRaw = Number(raw.rating);
  if (!Number.isFinite(ratingRaw) || ratingRaw < 0.5 || ratingRaw > 5) {
    return { ok: false, message: 'rating must be between 0.5 and 5.' };
  }

  const normalizedRating = Math.round(ratingRaw * 2) / 2;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 120) : '';
  const body = typeof raw.body === 'string' ? raw.body.trim().slice(0, 2000) : '';

  return {
    ok: true,
    data: {
      rating: normalizedRating,
      title: title.length > 0 ? title : null,
      body: body.length > 0 ? body : null,
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
      { ok: false, message: 'Only tenant accounts can submit property reviews.' },
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
      throw new Error(`query application failed: ${approvedApplicationResult.error.message}`);
    }

    if (!approvedApplicationResult.data) {
      return NextResponse.json(
        { ok: false, message: 'You can only review properties after your application is approved.' },
        { status: 403 },
      );
    }

    const existingReviewResult = await supabase
      .from('reviews')
      .select('id')
      .eq('property_id', listingResult.data.property_id)
      .eq('reviewer_user_id', authResult.data.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingReviewResult.error) {
      throw new Error(`query existing review failed: ${existingReviewResult.error.message}`);
    }

    const ratingForIntColumn = Math.round(payloadResult.data.rating);
    const writePayload = {
      property_id: listingResult.data.property_id,
      reviewer_user_id: authResult.data.id,
      reviewed_user_id: listingResult.data.created_by_user_id,
      rating: ratingForIntColumn,
      title: payloadResult.data.title,
      body: payloadResult.data.body,
      media_urls: null,
      is_verified_interaction: true,
      status: 'PUBLISHED',
      metadata: {
        ratingValue: payloadResult.data.rating,
        source: 'approved_tenant_review',
        listingId,
      },
      updated_at: nowIso,
    };

    let reviewId = existingReviewResult.data?.id ? String(existingReviewResult.data.id) : null;
    if (reviewId) {
      const updateResult = await supabase.from('reviews').update(writePayload).eq('id', reviewId);

      if (updateResult.error) {
        throw new Error(`update review failed: ${updateResult.error.message}`);
      }
    } else {
      reviewId = crypto.randomUUID();
      const insertResult = await supabase.from('reviews').insert({
        id: reviewId,
        ...writePayload,
        created_at: nowIso,
      });

      if (insertResult.error) {
        throw new Error(`create review failed: ${insertResult.error.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Review submitted successfully.',
      data: {
        reviewId,
        rating: payloadResult.data.rating,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit review.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
