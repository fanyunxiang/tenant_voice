import { handleExpiredSessionResponse, sessionExpiredError } from 'lib/auth/handleExpiredSessionClient';

type MessagesApiResult<TData = unknown> = {
  ok: boolean;
  message?: string;
  data?: TData;
};

type MessageConversationSummary = {
  id: string;
  title: string;
  role: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
};

type MessageItem = {
  id: string;
  sender: 'me' | 'other' | 'system';
  senderName: string;
  text: string;
  createdAt: string;
};

type LoadMessagesData = {
  currentUserId: string;
  conversations: MessageConversationSummary[];
  selectedConversationId: string | null;
  messages: MessageItem[];
};

const REQUEST_TIMEOUT_MS = 15000;

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

async function parseResult<TData>(response: Response): Promise<MessagesApiResult<TData>> {
  let body: MessagesApiResult<TData> | null = null;
  try {
    body = (await response.json()) as MessagesApiResult<TData>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (handleExpiredSessionResponse(response)) {
      throw sessionExpiredError();
    }
    throw new Error(body?.message || 'Request failed.');
  }

  return body ?? { ok: true };
}

async function requestMessages<TData>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<MessagesApiResult<TData>> {
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

export async function loadTenantMessages(payload?: { conversationId?: string | null }) {
  const searchParams = new URLSearchParams();
  if (payload?.conversationId) {
    searchParams.set('conversationId', payload.conversationId);
  }

  const query = searchParams.toString();
  const endpoint = query ? `/api/tenant/messages?${query}` : '/api/tenant/messages';

  return requestMessages<LoadMessagesData>(endpoint, {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function sendTenantMessage(payload: { conversationId: string; content: string }) {
  return requestMessages<{ id: string }>('/api/tenant/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'send',
      conversationId: payload.conversationId,
      content: payload.content,
    }),
  });
}

export async function markConversationRead(payload: { conversationId: string }) {
  return requestMessages<{ conversationId: string }>('/api/tenant/messages', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'markRead',
      conversationId: payload.conversationId,
    }),
  });
}

export type { LoadMessagesData, MessageConversationSummary, MessageItem };
