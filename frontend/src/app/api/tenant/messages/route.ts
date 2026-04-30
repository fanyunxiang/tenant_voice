import { NextRequest, NextResponse } from 'next/server';
import { findAppUserByAuthUserId } from 'lib/auth/userProvisioning';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from 'lib/auth/constants';
import { parseJsonBody } from 'lib/auth/validation';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';
import { getSupabaseServerClient } from 'lib/supabase/serverClient';
import type { User } from '@supabase/supabase-js';
import { buildExpiredSessionResponse, getRequestSessionExpiryValue, isSessionWindowExpired } from 'lib/auth/authErrors';

type AuthContext = {
  appUser: {
    id: string;
    full_name: string | null;
    email: string;
  };
};

type ConversationRow = {
  id: string;
  subject: string | null;
  conversation_type: string | null;
  updated_at: string | null;
};

type ConversationParticipantRow = {
  conversation_id: string;
  user_id: string;
  role_label: string | null;
  last_read_at: string | null;
};

type UserPreviewRow = {
  id: string;
  full_name: string | null;
  email: string;
  primary_role: string | null;
};

type MessageRow = {
  id: string;
  sender_user_id: string | null;
  content: string | null;
  message_type: string | null;
  created_at: string;
};

type SendMessagePayload = {
  action: 'send';
  conversationId: string;
  content: string;
};

type MarkReadPayload = {
  action: 'markRead';
  conversationId: string;
};

export async function GET(request: NextRequest) {
  const authResult = await resolveAuthenticatedUser(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const conversationId = request.nextUrl.searchParams.get('conversationId');

  try {
    const data = await buildMessagesData(authResult.data, conversationId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load messages.';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await resolveAuthenticatedUser(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const payloadResult = parseSendPayload(bodyResult.data);
  if (payloadResult.ok === false) {
    return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const participantResult = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', payloadResult.data.conversationId)
    .eq('user_id', authResult.data.appUser.id)
    .maybeSingle();

  if (participantResult.error || !participantResult.data) {
    return NextResponse.json(
      { ok: false, message: 'You do not have access to this conversation.' },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();
  const insertResult = await supabase
    .from('messages')
    .insert({
      conversation_id: payloadResult.data.conversationId,
      sender_user_id: authResult.data.appUser.id,
      message_type: 'TEXT',
      content: payloadResult.data.content,
      metadata: null,
      created_at: nowIso,
    })
    .select('id, sender_user_id, content, created_at')
    .single();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json(
      { ok: false, message: insertResult.error?.message || 'Failed to send message.' },
      { status: 500 },
    );
  }

  const touchConversationResult = await supabase
    .from('conversations')
    .update({ updated_at: nowIso })
    .eq('id', payloadResult.data.conversationId);

  if (touchConversationResult.error) {
    return NextResponse.json(
      { ok: false, message: `Message sent but failed to update conversation: ${touchConversationResult.error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: insertResult.data.id,
      senderUserId: insertResult.data.sender_user_id,
      content: insertResult.data.content,
      createdAt: insertResult.data.created_at,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const authResult = await resolveAuthenticatedUser(request);
  if (authResult.ok === false) {
    return authResult.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult.ok === false) {
    return NextResponse.json({ ok: false, message: bodyResult.message }, { status: 400 });
  }

  const payloadResult = parseMarkReadPayload(bodyResult.data);
  if (payloadResult.ok === false) {
    return NextResponse.json({ ok: false, message: payloadResult.message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const markReadResult = await supabase
    .from('conversation_participants')
    .update({ last_read_at: nowIso })
    .eq('conversation_id', payloadResult.data.conversationId)
    .eq('user_id', authResult.data.appUser.id);

  if (markReadResult.error) {
    return NextResponse.json(
      { ok: false, message: `Failed to mark as read: ${markReadResult.error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data: { conversationId: payloadResult.data.conversationId } });
}

async function buildMessagesData(context: AuthContext, requestedConversationId: string | null) {
  const supabase = getSupabaseServerClient();
  const selfId = context.appUser.id;

  const selfParticipantResult = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', selfId);

  if (selfParticipantResult.error) {
    throw new Error(`query participants failed: ${selfParticipantResult.error.message}`);
  }

  const selfParticipants = (selfParticipantResult.data ?? []) as Array<{
    conversation_id: string;
    last_read_at: string | null;
  }>;

  const conversationIds = selfParticipants.map((row) => row.conversation_id);
  const lastReadByConversationId = new Map<string, string | null>(
    selfParticipants.map((row) => [row.conversation_id, row.last_read_at]),
  );

  if (conversationIds.length === 0) {
    return {
      currentUserId: selfId,
      conversations: [],
      selectedConversationId: null,
      messages: [],
    };
  }

  const conversationsResult = await supabase
    .from('conversations')
    .select('id, subject, conversation_type, updated_at')
    .in('id', conversationIds);

  if (conversationsResult.error) {
    throw new Error(`query conversations failed: ${conversationsResult.error.message}`);
  }

  const conversations = ((conversationsResult.data ?? []) as ConversationRow[]).sort((a, b) =>
    (b.updated_at || '').localeCompare(a.updated_at || ''),
  );

  const participantsResult = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id, role_label, last_read_at')
    .in('conversation_id', conversationIds);

  if (participantsResult.error) {
    throw new Error(`query conversation participants failed: ${participantsResult.error.message}`);
  }

  const participantRows = (participantsResult.data ?? []) as ConversationParticipantRow[];
  const participantsByConversation = new Map<string, ConversationParticipantRow[]>();
  participantRows.forEach((row) => {
    const current = participantsByConversation.get(row.conversation_id) ?? [];
    current.push(row);
    participantsByConversation.set(row.conversation_id, current);
  });

  const participantUserIds = Array.from(new Set(participantRows.map((row) => row.user_id)));
  const usersResult = await supabase
    .from('users')
    .select('id, full_name, email, primary_role')
    .in('id', participantUserIds);

  if (usersResult.error) {
    throw new Error(`query users failed: ${usersResult.error.message}`);
  }

  const users = (usersResult.data ?? []) as UserPreviewRow[];
  const usersById = new Map(users.map((row) => [row.id, row]));

  const summaries = await Promise.all(
    conversations.map(async (conversation) => {
      const participants = participantsByConversation.get(conversation.id) ?? [];
      const peers = participants.filter((participant) => participant.user_id !== selfId);
      const peer = peers[0];
      const peerUser = peer ? usersById.get(peer.user_id) : null;

      const lastMessageResult = await supabase
        .from('messages')
        .select('id, sender_user_id, content, created_at, message_type')
        .eq('conversation_id', conversation.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMessageResult.error) {
        throw new Error(`query last message failed: ${lastMessageResult.error.message}`);
      }

      let unreadCountQuery = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id)
        .is('deleted_at', null)
        .neq('sender_user_id', selfId);

      const lastReadAt = lastReadByConversationId.get(conversation.id);
      if (lastReadAt) {
        unreadCountQuery = unreadCountQuery.gt('created_at', lastReadAt);
      }

      const unreadCountResult = await unreadCountQuery;
      if (unreadCountResult.error) {
        throw new Error(`query unread count failed: ${unreadCountResult.error.message}`);
      }

      const lastMessage = (lastMessageResult.data ?? null) as MessageRow | null;
      return {
        id: conversation.id,
        title:
          conversation.subject ||
          peerUser?.full_name ||
          peerUser?.email ||
          formatConversationType(conversation.conversation_type),
        role:
          peer?.role_label || formatUserRole(peerUser?.primary_role) || formatConversationType(conversation.conversation_type),
        lastMessage:
          lastMessage?.content ||
          (lastMessage?.message_type === 'SYSTEM' ? '[System message]' : 'No messages yet.'),
        lastMessageAt: lastMessage?.created_at || conversation.updated_at,
        unreadCount: unreadCountResult.count ?? 0,
      };
    }),
  );

  const selectedConversationId =
    requestedConversationId && summaries.some((item) => item.id === requestedConversationId)
      ? requestedConversationId
      : summaries[0]?.id || null;

  let messages: Array<{
    id: string;
    sender: 'me' | 'other' | 'system';
    senderName: string;
    text: string;
    createdAt: string;
  }> = [];

  if (selectedConversationId) {
    const messagesResult = await supabase
      .from('messages')
      .select('id, sender_user_id, content, created_at, message_type')
      .eq('conversation_id', selectedConversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (messagesResult.error) {
      throw new Error(`query messages failed: ${messagesResult.error.message}`);
    }

    const messageRows = (messagesResult.data ?? []) as MessageRow[];
    messages = messageRows.map((message) => {
      const senderUser = message.sender_user_id ? usersById.get(message.sender_user_id) : null;
      const sender =
        message.message_type === 'SYSTEM'
          ? 'system'
          : message.sender_user_id === selfId
            ? 'me'
            : 'other';

      return {
        id: message.id,
        sender,
        senderName:
          sender === 'me'
            ? 'You'
            : senderUser?.full_name || senderUser?.email || (sender === 'system' ? 'System' : 'Unknown'),
        text:
          message.content ||
          (message.message_type === 'SYSTEM' ? '[System message]' : '[Empty message]'),
        createdAt: message.created_at,
      };
    });
  }

  return {
    currentUserId: selfId,
    conversations: summaries,
    selectedConversationId,
    messages,
  };
}

function parseSendPayload(
  raw: Record<string, unknown>,
): { ok: true; data: SendMessagePayload } | { ok: false; message: string } {
  if (raw.action !== 'send') {
    return { ok: false, message: 'Unsupported action for POST. Use action=send.' };
  }

  if (typeof raw.conversationId !== 'string' || raw.conversationId.trim().length === 0) {
    return { ok: false, message: 'conversationId is required.' };
  }

  if (typeof raw.content !== 'string') {
    return { ok: false, message: 'content must be a string.' };
  }

  const content = raw.content.trim();
  if (content.length === 0) {
    return { ok: false, message: 'Message cannot be empty.' };
  }

  if (content.length > 2000) {
    return { ok: false, message: 'Message is too long. Maximum is 2000 characters.' };
  }

  return {
    ok: true,
    data: {
      action: 'send',
      conversationId: raw.conversationId.trim(),
      content,
    },
  };
}

function parseMarkReadPayload(
  raw: Record<string, unknown>,
): { ok: true; data: MarkReadPayload } | { ok: false; message: string } {
  if (raw.action !== 'markRead') {
    return { ok: false, message: 'Unsupported action for PATCH. Use action=markRead.' };
  }

  if (typeof raw.conversationId !== 'string' || raw.conversationId.trim().length === 0) {
    return { ok: false, message: 'conversationId is required.' };
  }

  return {
    ok: true,
    data: {
      action: 'markRead',
      conversationId: raw.conversationId.trim(),
    },
  };
}

function formatUserRole(role: string | null | undefined) {
  if (!role) {
    return '';
  }

  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatConversationType(type: string | null | undefined) {
  if (!type) {
    return 'Conversation';
  }

  return (
    type.charAt(0).toUpperCase() +
    type
      .slice(1)
      .toLowerCase()
      .replace(/_/g, ' ')
  );
}

async function resolveAuthenticatedUser(
  request: NextRequest,
): Promise<
  | {
      ok: true;
      data: AuthContext;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const expiresAt = getRequestSessionExpiryValue(request);
  if (isSessionWindowExpired(expiresAt)) {
    return {
      ok: false,
      response: buildExpiredSessionResponse(),
    };
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return {
      ok: false,
      response: buildExpiredSessionResponse(),
    };
  }

  const authClient = getSupabaseAuthClient();
  let authUser: User | null = null;
  if (accessToken) {
    const authUserResult = await authClient.auth.getUser(accessToken);
    if (!authUserResult.error && authUserResult.data.user) {
      authUser = authUserResult.data.user;
    }
  }

  if (!authUser && refreshToken) {
    const refreshResult = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (!refreshResult.error && refreshResult.data.session?.user) {
      authUser = refreshResult.data.session.user;
    }
  }

  if (!authUser) {
    return {
      ok: false,
      response: buildExpiredSessionResponse(),
    };
  }

  const appUser = await findAppUserByAuthUserId(authUser.id);
  if (!appUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Authenticated user is not provisioned.' },
        { status: 404 },
      ),
    };
  }

  const supabase = getSupabaseServerClient();
  const currentUserResult = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('id', appUser.id)
    .single();

  if (currentUserResult.error || !currentUserResult.data) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: 'Unable to load current user profile.' },
        { status: 500 },
      ),
    };
  }

  return {
    ok: true,
    data: {
      appUser: currentUserResult.data as AuthContext['appUser'],
    },
  };
}
