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
  bond_amount: number | string | null;
  available_from: string | null;
  lease_term_months: number | null;
  status: string;
  published_at: string | null;
};

type PropertyRow = {
  id: string;
  property_type: string;
  address_line_1: string;
  address_line_2: string | null;
  suburb: string;
  state: string;
  postcode: string;
  country: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  pet_friendly: boolean | null;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string;
};

type ApplicationRow = {
  id: string;
  applicant_user_id: string;
  status: string;
  submitted_at: string | null;
  last_status_at: string | null;
};

type ReviewRow = {
  id: string;
  reviewer_user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified_interaction: boolean | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

function parseReviewScore(review: ReviewRow) {
  const metadata = review.metadata as { ratingValue?: unknown } | null;
  if (metadata && typeof metadata.ratingValue === 'number' && Number.isFinite(metadata.ratingValue)) {
    const normalized = Math.min(5, Math.max(0.5, Math.round(metadata.ratingValue * 2) / 2));
    return normalized;
  }

  const fallback = Number(review.rating);
  if (!Number.isFinite(fallback)) {
    return 0;
  }

  return Math.min(5, Math.max(0.5, fallback));
}

function averageRating(reviews: ReviewRow[]) {
  if (reviews.length === 0) {
    return null;
  }

  const total = reviews.reduce((sum, review) => sum + parseReviewScore(review), 0);
  return Number((total / reviews.length).toFixed(2));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ listingId: string }> },
) {
  const authResult = await resolveAuthenticatedAppUser(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const params = await context.params;
  const listingId = params.listingId?.trim();
  if (!listingId) {
    return NextResponse.json({ ok: false, message: 'listingId is required.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  try {
    const listingResult = await supabase
      .from('listings')
      .select(
        'id, property_id, created_by_user_id, title, description, weekly_rent, bond_amount, available_from, lease_term_months, status, published_at',
      )
      .eq('id', listingId)
      .maybeSingle();

    if (listingResult.error) {
      throw new Error(`query listing failed: ${listingResult.error.message}`);
    }

    if (!listingResult.data) {
      return NextResponse.json({ ok: false, message: 'Listing not found.' }, { status: 404 });
    }

    const listing = listingResult.data as ListingRow;
    const isOwner = listing.created_by_user_id === authResult.data.id;
    const isVisible = listing.status === 'PUBLISHED' || isOwner;
    if (!isVisible) {
      return NextResponse.json({ ok: false, message: 'Listing not available.' }, { status: 404 });
    }

    const [
      propertyResult,
      landlordResult,
      applicationsResult,
      propertyReviewsResult,
      landlordReviewsResult,
      myReviewResult,
      myMaintenanceResult,
    ] =
      await Promise.all([
        supabase
          .from('properties')
          .select(
            'id, property_type, address_line_1, address_line_2, suburb, state, postcode, country, bedrooms, bathrooms, parking_spaces, pet_friendly',
          )
          .eq('id', listing.property_id)
          .maybeSingle(),
        supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', listing.created_by_user_id)
          .maybeSingle(),
        supabase
          .from('rental_applications')
          .select('id, applicant_user_id, status, submitted_at, last_status_at')
          .eq('listing_id', listing.id),
        supabase
          .from('reviews')
          .select('id, reviewer_user_id, rating, title, body, is_verified_interaction, metadata, created_at, updated_at')
          .eq('property_id', listing.property_id)
          .eq('status', 'PUBLISHED')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('reviews')
          .select('id, reviewer_user_id, rating, title, body, is_verified_interaction, metadata, created_at, updated_at')
          .eq('reviewed_user_id', listing.created_by_user_id)
          .eq('status', 'PUBLISHED')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('reviews')
          .select('id, reviewer_user_id, rating, title, body, is_verified_interaction, metadata, created_at, updated_at')
          .eq('property_id', listing.property_id)
          .eq('reviewer_user_id', authResult.data.id)
          .eq('status', 'PUBLISHED')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('complaints')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', listing.property_id)
          .eq('reporter_user_id', authResult.data.id)
          .in('status', ['OPEN', 'IN_REVIEW', 'ESCALATED']),
      ]);

    if (propertyResult.error) {
      throw new Error(`query property failed: ${propertyResult.error.message}`);
    }
    if (landlordResult.error) {
      throw new Error(`query landlord failed: ${landlordResult.error.message}`);
    }
    if (applicationsResult.error) {
      throw new Error(`query applications failed: ${applicationsResult.error.message}`);
    }
    if (propertyReviewsResult.error) {
      throw new Error(`query property reviews failed: ${propertyReviewsResult.error.message}`);
    }
    if (landlordReviewsResult.error) {
      throw new Error(`query landlord reviews failed: ${landlordReviewsResult.error.message}`);
    }
    if (myReviewResult.error) {
      throw new Error(`query my review failed: ${myReviewResult.error.message}`);
    }
    if (myMaintenanceResult.error) {
      throw new Error(`query my maintenance requests failed: ${myMaintenanceResult.error.message}`);
    }

    if (!propertyResult.data || !landlordResult.data) {
      return NextResponse.json({ ok: false, message: 'Listing details are incomplete.' }, { status: 500 });
    }

    const property = propertyResult.data as PropertyRow;
    const landlord = landlordResult.data as UserRow;
    const applications = (applicationsResult.data ?? []) as ApplicationRow[];
    const propertyReviews = (propertyReviewsResult.data ?? []) as ReviewRow[];
    const landlordReviews = (landlordReviewsResult.data ?? []) as ReviewRow[];

    const reviewerUserIds = Array.from(
      new Set([...propertyReviews, ...landlordReviews].map((review) => review.reviewer_user_id)),
    );

    let reviewersById = new Map<string, UserRow>();
    if (reviewerUserIds.length > 0) {
      const reviewersResult = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', reviewerUserIds);

      if (reviewersResult.error) {
        throw new Error(`query review authors failed: ${reviewersResult.error.message}`);
      }

      reviewersById = new Map<string, UserRow>(
        ((reviewersResult.data ?? []) as UserRow[]).map((user) => [user.id, user]),
      );
    }

    const statusCounts = applications.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.status || 'UNKNOWN');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const myApplication =
      applications.find((row) => row.applicant_user_id === authResult.data.id) ?? null;
    const myApplicationStatus = String(myApplication?.status || '').toUpperCase();
    const canReview = authResult.data.primaryRole === 'TENANT' && myApplicationStatus === 'APPROVED';
    const canRequestMaintenance = canReview;
    const myReview = (myReviewResult.data as ReviewRow | null) ?? null;
    const myOpenMaintenanceCount = myMaintenanceResult.count ?? 0;

    const mapReview = (review: ReviewRow) => {
      const reviewer = reviewersById.get(review.reviewer_user_id);
      return {
        id: review.id,
        rating: parseReviewScore(review),
        title: review.title,
        body: review.body,
        isVerifiedInteraction: Boolean(review.is_verified_interaction),
        createdAt: review.created_at,
        reviewerName: reviewer?.full_name?.trim() || reviewer?.email || 'Verified user',
      };
    };

    return NextResponse.json({
      ok: true,
      data: {
        viewerRole: authResult.data.primaryRole,
        listing: {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          weeklyRent: Number(listing.weekly_rent),
          bondAmount: listing.bond_amount === null ? null : Number(listing.bond_amount),
          availableFrom: listing.available_from,
          leaseTermMonths: listing.lease_term_months,
          status: listing.status,
          publishedAt: listing.published_at,
        },
        property: {
          id: property.id,
          propertyType: property.property_type,
          addressLine1: property.address_line_1,
          addressLine2: property.address_line_2,
          suburb: property.suburb,
          state: property.state,
          postcode: property.postcode,
          country: property.country,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          parkingSpaces: property.parking_spaces,
          petFriendly: Boolean(property.pet_friendly),
        },
        landlord: {
          id: landlord.id,
          name: landlord.full_name?.trim() || landlord.email,
          email: landlord.email,
        },
        rentalInsight: {
          totalApplications: applications.length,
          submittedCount: statusCounts.SUBMITTED ?? 0,
          underReviewCount: statusCounts.UNDER_REVIEW ?? 0,
          shortlistedCount: statusCounts.SHORTLISTED ?? 0,
          approvedCount: statusCounts.APPROVED ?? 0,
          leasedCount: statusCounts.APPROVED ?? 0,
          listingStatus: listing.status,
          myApplication: myApplication
            ? {
                id: myApplication.id,
                status: myApplication.status,
                submittedAt: myApplication.submitted_at,
                lastStatusAt: myApplication.last_status_at,
              }
            : null,
        },
        actions: {
          canReview,
          canRequestMaintenance,
          myOpenMaintenanceCount,
          myReview: myReview
            ? {
                id: myReview.id,
                rating: parseReviewScore(myReview),
                title: myReview.title,
                body: myReview.body,
                createdAt: myReview.created_at,
                updatedAt: myReview.updated_at,
              }
            : null,
        },
        reviews: {
          property: {
            averageRating: averageRating(propertyReviews),
            totalCount: propertyReviews.length,
            recent: propertyReviews.slice(0, 5).map(mapReview),
          },
          landlord: {
            averageRating: averageRating(landlordReviews),
            totalCount: landlordReviews.length,
            recent: landlordReviews.slice(0, 5).map(mapReview),
          },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load listing details.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
