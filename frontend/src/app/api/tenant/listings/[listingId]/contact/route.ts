import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from 'lib/auth/validation';
import { resolveAuthenticatedAppUser } from 'lib/landlord/authServer';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';

type ContactPayload = {
  content: string | null;
};

type ConversationRow = {
  id: string;
};

type ParticipantRow = {
  conversation_id: string;
  user_id: string;
};

function parsePayload(raw: Record<string, unknown>): { ok: true; data: ContactPayload } | { ok: false; message: string } {
  const content = typeof raw.content === 'string' ? raw.content.trim() : '';

  if (content.length > 2000) {
    return { ok: false, message: 'Message is too long. Maximum is 2000 characters.' };
  }

  return {
    ok: true,
    data: {
      content: content.length > 0 ? content : null,
    },
  };
}

async function findExistingConversationId(
  candidateConversations: ConversationRow[],
  participantRows: ParticipantRow[],
  currentUserId: string,
  landlordUserId: string,
) {
  const participantsByConversation = new Map<string, Set<string>>();

  participantRows.forEach((row) => {
    const key = String(row.conversation_id);
    const participants = participantsByConversation.get(key) ?? new Set<string>();
    participants.add(String(row.user_id));
    participantsByConversation.set(key, participants);
  });

  for (const conversation of candidateConversations) {
    const participantSet = participantsByConversation.get(String(conversation.id));
    if (!participantSet) {
      continue;
    }

    if (participantSet.has(currentUserId) && participantSet.has(landlordUserId)) {
      return String(conversation.id);
    }
  }

  return null;
}

export async function POST(
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
      .select('id, title, created_by_user_id, status')
      .eq('id', listingId)
      .maybeSingle();

    if (listingResult.error) {
      throw new Error(`query listing failed: ${listingResult.error.message}`);
    }

    if (!listingResult.data) {
      return NextResponse.json({ ok: false, message: 'Listing not found.' }, { status: 404 });
    }

    const listingStatus = String(listingResult.data.status || '');
    const landlordUserId = String(listingResult.data.created_by_user_id || '');
    const listingTitle = String(listingResult.data.title || 'Listing enquiry');

    if (!landlordUserId) {
      return NextResponse.json({ ok: false, message: 'Listing owner not found.' }, { status: 500 });
    }

    if (landlordUserId === authResult.data.id) {
      return NextResponse.json(
        { ok: false, message: 'You cannot start a direct conversation with yourself.' },
        { status: 400 },
      );
    }

    if (listingStatus !== 'PUBLISHED') {
      return NextResponse.json(
        { ok: false, message: 'This listing is currently unavailable for enquiries.' },
        { status: 400 },
      );
    }

    const candidatesResult = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('conversation_type', 'PROPERTY')
      .order('updated_at', { ascending: false })
      .limit(30);

    if (candidatesResult.error) {
      throw new Error(`query existing conversations failed: ${candidatesResult.error.message}`);
    }

    const candidateConversations = (candidatesResult.data ?? []) as ConversationRow[];
    const candidateIds = candidateConversations.map((row) => row.id);

    let conversationId: string | null = null;
    if (candidateIds.length > 0) {
      const participantsResult = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', candidateIds)
        .in('user_id', [authResult.data.id, landlordUserId]);

      if (participantsResult.error) {
        throw new Error(`query conversation participants failed: ${participantsResult.error.message}`);
      }

      conversationId = await findExistingConversationId(
        candidateConversations,
        (participantsResult.data ?? []) as ParticipantRow[],
        authResult.data.id,
        landlordUserId,
      );
    }

    if (!conversationId) {
      const newConversationId = crypto.randomUUID();
      const createConversationResult = await supabase
        .from('conversations')
        .insert({
          id: newConversationId,
          conversation_type: 'PROPERTY',
          subject: `Enquiry: ${listingTitle}`,
          listing_id: listingId,
          application_id: null,
          created_by_user_id: authResult.data.id,
          metadata: {
            source: 'listing_detail_contact',
          },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .single();

      if (createConversationResult.error || !createConversationResult.data) {
        throw new Error(
          `create conversation failed: ${createConversationResult.error?.message || 'unknown error'}`,
        );
      }

      conversationId = String(createConversationResult.data.id);

      const participantsInsertResult = await supabase.from('conversation_participants').insert([
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: authResult.data.id,
          role_label: authResult.data.primaryRole === 'TENANT' ? 'Tenant' : 'User',
          joined_at: nowIso,
          last_read_at: nowIso,
          is_muted: false,
        },
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: landlordUserId,
          role_label: 'Landlord',
          joined_at: nowIso,
          last_read_at: null,
          is_muted: false,
        },
      ]);

      if (participantsInsertResult.error) {
        throw new Error(`add participants failed: ${participantsInsertResult.error.message}`);
      }
    }

    let sentMessageId: string | null = null;
    if (payloadResult.data.content) {
      const messageInsertResult = await supabase
        .from('messages')
        .insert({
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          sender_user_id: authResult.data.id,
          message_type: 'TEXT',
          content: payloadResult.data.content,
          metadata: null,
          created_at: nowIso,
        })
        .select('id')
        .single();

      if (messageInsertResult.error || !messageInsertResult.data) {
        throw new Error(`send message failed: ${messageInsertResult.error?.message || 'unknown error'}`);
      }

      sentMessageId = String(messageInsertResult.data.id);
    }

    const touchConversationResult = await supabase
      .from('conversations')
      .update({ updated_at: nowIso })
      .eq('id', conversationId);

    if (touchConversationResult.error) {
      throw new Error(`update conversation failed: ${touchConversationResult.error.message}`);
    }

    return NextResponse.json({
      ok: true,
      message: sentMessageId ? 'Message sent to landlord.' : 'Conversation is ready.',
      data: {
        conversationId,
        messageId: sentMessageId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to contact landlord.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
