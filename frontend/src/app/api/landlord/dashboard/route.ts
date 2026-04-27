import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';
import { resolveAuthenticatedLandlord } from 'lib/landlord/authServer';

type ListingRow = {
  id: string;
  status: string;
};

type ParticipantRow = {
  conversation_id: string;
  last_read_at: string | null;
};

const ACTIVE_MAINTENANCE_STATUSES = ['OPEN', 'IN_REVIEW', 'ESCALATED'] as const;
const PENDING_RENT_STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'APPLICATIONS_CLOSED'] as const;
const PENDING_APPLICATION_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'] as const;

export async function GET(request: NextRequest) {
  const authResult = await resolveAuthenticatedLandlord(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const supabase = getSupabaseServerClient();

  try {
    const propertiesResult = await supabase
      .from('properties')
      .select('id')
      .eq('owner_user_id', authResult.data.id);

    if (propertiesResult.error) {
      throw new Error(`query properties failed: ${propertiesResult.error.message}`);
    }

    const propertyIds = (propertiesResult.data ?? []).map((row) => row.id as string);
    if (propertyIds.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          inRentCount: 0,
          pendingRentCount: 0,
          maintenanceCount: 0,
          pendingApplicationsCount: 0,
          unreadMessagesCount: 0,
        },
      });
    }

    const listingsResult = await supabase
      .from('listings')
      .select('id, status')
      .in('property_id', propertyIds);

    if (listingsResult.error) {
      throw new Error(`query listings failed: ${listingsResult.error.message}`);
    }

    const listings = (listingsResult.data ?? []) as ListingRow[];
    const listingIds = listings.map((listing) => listing.id);

    const inRentCount = listings.filter((listing) => listing.status === 'LEASED').length;
    const pendingRentCount = listings.filter((listing) =>
      PENDING_RENT_STATUSES.includes(listing.status as (typeof PENDING_RENT_STATUSES)[number]),
    ).length;

    const maintenanceResult = await supabase
      .from('complaints')
      .select('property_id')
      .in('property_id', propertyIds)
      .in('status', [...ACTIVE_MAINTENANCE_STATUSES]);

    if (maintenanceResult.error) {
      throw new Error(`query complaints failed: ${maintenanceResult.error.message}`);
    }

    const maintenancePropertyIds = new Set(
      (maintenanceResult.data ?? [])
        .map((item) => (item.property_id ? String(item.property_id) : null))
        .filter((item): item is string => Boolean(item)),
    );

    let pendingApplicationsCount = 0;
    if (listingIds.length > 0) {
      const pendingApplicationsResult = await supabase
        .from('rental_applications')
        .select('id', { count: 'exact', head: true })
        .in('listing_id', listingIds)
        .in('status', [...PENDING_APPLICATION_STATUSES]);

      if (pendingApplicationsResult.error) {
        throw new Error(`query rental applications failed: ${pendingApplicationsResult.error.message}`);
      }

      pendingApplicationsCount = pendingApplicationsResult.count ?? 0;
    }

    const participantsResult = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', authResult.data.id);

    if (participantsResult.error) {
      throw new Error(`query conversation participants failed: ${participantsResult.error.message}`);
    }

    const participants = (participantsResult.data ?? []) as ParticipantRow[];
    let unreadMessagesCount = 0;

    await Promise.all(
      participants.map(async (participant) => {
        let unreadQuery = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', participant.conversation_id)
          .is('deleted_at', null)
          .neq('sender_user_id', authResult.data.id);

        if (participant.last_read_at) {
          unreadQuery = unreadQuery.gt('created_at', participant.last_read_at);
        }

        const unreadResult = await unreadQuery;
        if (unreadResult.error) {
          throw new Error(`query unread messages failed: ${unreadResult.error.message}`);
        }

        unreadMessagesCount += unreadResult.count ?? 0;
      }),
    );

    return NextResponse.json({
      ok: true,
      data: {
        inRentCount,
        pendingRentCount,
        maintenanceCount: maintenancePropertyIds.size,
        pendingApplicationsCount,
        unreadMessagesCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load landlord dashboard.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
