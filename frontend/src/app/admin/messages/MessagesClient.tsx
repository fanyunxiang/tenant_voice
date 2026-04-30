'use client';

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Card from 'components/card/Card';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Input,
  SimpleGrid,
  Text,
  useColorModeValue,
} from 'lib/chakra';
import {
  loadTenantMessages,
  markConversationRead,
  sendTenantMessage,
  type LoadMessagesData,
  type MessageConversationSummary,
  type MessageItem,
} from 'lib/tenant/messagesClient';
import { handleExpiredSessionResponse, sessionExpiredError } from 'lib/auth/handleExpiredSessionClient';
import { getSupabaseBrowserClient } from 'lib/supabase/browserClient';
import { loadSession } from 'lib/auth/client';

const FALLBACK_REFRESH_INTERVAL_MS = 30000;
const TOKEN_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

const tenantRecommendations = [
  { id: 'rec1', label: '2-bed in Parramatta', reason: 'Within budget + high owner rating' },
  { id: 'rec2', label: '1-bed in Strathfield', reason: 'Near preferred commute + pet friendly' },
];

const landlordLeads = [
  { id: 'lead1', label: 'New enquiry for 2-bed in Parramatta', reason: 'Tenant asks for inspection time' },
  { id: 'lead2', label: 'Application follow-up needed', reason: 'Missing proof of income document' },
];

function formatChatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function makeInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export default function MessagesClient() {
  const { showNotice } = useGlobalNotice();
  const [conversations, setConversations] = useState<MessageConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [isLandlord, setIsLandlord] = useState(false);

  const selectedConversationIdRef = useRef<string | null>(null);
  const conversationIdsRef = useRef<Set<string>>(new Set());

  const pageBg = useColorModeValue('secondaryGray.300', 'navy.900');
  const cardBg = useColorModeValue('white', 'navy.800');
  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const mineBg = useColorModeValue('brand.100', 'brand.500');
  const otherBg = useColorModeValue('secondaryGray.200', 'whiteAlpha.100');
  const sendButtonBg = useColorModeValue('brand.500', 'brand.300');
  const sendButtonHoverBg = useColorModeValue('brand.600', 'brand.400');

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map((conversation) => conversation.id));
  }, [conversations]);

  const fetchRealtimeAccessToken = useCallback(async () => {
    const response = await fetch('/api/auth/realtime-token', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });

    let body:
      | {
          ok?: boolean;
          message?: string;
          data?: { accessToken?: string };
        }
      | null = null;

    try {
      body = (await response.json()) as typeof body;
    } catch {
      body = null;
    }

    if (!response.ok || !body?.ok || !body.data?.accessToken) {
      if (handleExpiredSessionResponse(response)) {
        throw sessionExpiredError();
      }
      throw new Error(body?.message || 'Failed to initialize realtime authentication.');
    }

    return body.data.accessToken;
  }, []);

  const maybeMarkSelectedConversationAsRead = useCallback(
    (data: LoadMessagesData) => {
      const selectedId = data.selectedConversationId;
      if (!selectedId) {
        return data.conversations;
      }

      const selectedSummary = data.conversations.find((item) => item.id === selectedId);
      if (!selectedSummary || selectedSummary.unreadCount <= 0) {
        return data.conversations;
      }

      void markConversationRead({ conversationId: selectedId }).catch(() => undefined);

      return data.conversations.map((item) =>
        item.id === selectedId ? { ...item, unreadCount: 0 } : item,
      );
    },
    [],
  );

  const refreshMessages = useCallback(
    async (options?: { conversationId?: string | null; silent?: boolean }) => {
      const shouldLoadSilently = options?.silent ?? false;
      if (!shouldLoadSilently) {
        setIsLoading(true);
      }

      try {
        const result = await loadTenantMessages({
          conversationId: options?.conversationId ?? selectedConversationIdRef.current,
        });

        if (!result.ok || !result.data) {
          throw new Error(result.message || 'Failed to load messages.');
        }

        const normalizedConversations = maybeMarkSelectedConversationAsRead(result.data);
        setCurrentUserId(result.data.currentUserId);
        setConversations(normalizedConversations);
        setSelectedConversationId(result.data.selectedConversationId);
        setMessages(result.data.messages);
        setLoadError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load messages.';
        setLoadError(message);

        if (!shouldLoadSilently) {
          showNotice({ type: 'error', message });
        }
      } finally {
        if (!shouldLoadSilently) {
          setIsLoading(false);
        }
      }
    },
    [maybeMarkSelectedConversationAsRead, showNotice],
  );

  useEffect(() => {
    let cancelled = false;

    const syncRole = async () => {
      try {
        const result = await loadSession();
        if (!cancelled) {
          setIsLandlord(Boolean(result.ok && result.user?.primary_role === 'LANDLORD'));
        }
      } catch {
        if (!cancelled) {
          setIsLandlord(false);
        }
      }
    };

    void syncRole();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshMessages({ silent: false });
  }, [refreshMessages]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let isClosed = false;
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribeRealtime = async () => {
      try {
        const realtimeAccessToken = await fetchRealtimeAccessToken();
        if (isClosed) {
          return;
        }

        await supabase.realtime.setAuth(realtimeAccessToken);
        if (isClosed) {
          return;
        }

        channel = supabase
          .channel(`tenant-messages-${currentUserId}-${Date.now()}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const incomingConversationId = String((payload.new as { conversation_id?: string }).conversation_id || '');
            if (
              incomingConversationId &&
              (conversationIdsRef.current.size === 0 ||
                conversationIdsRef.current.has(incomingConversationId))
            ) {
              void refreshMessages({
                conversationId: selectedConversationIdRef.current,
                silent: true,
              });
            }
          })
          .subscribe((status) => {
            if (isClosed) {
              return;
            }
            setRealtimeConnected(status === 'SUBSCRIBED');
          });
      } catch {
        if (!isClosed) {
          setRealtimeConnected(false);
        }
      }
    };

    void subscribeRealtime();

    const fallbackRefreshTimer = setInterval(() => {
      void refreshMessages({
        conversationId: selectedConversationIdRef.current,
        silent: true,
      });
    }, FALLBACK_REFRESH_INTERVAL_MS);

    const tokenRefreshTimer = setInterval(() => {
      void (async () => {
        try {
          const refreshedToken = await fetchRealtimeAccessToken();
          await supabase.realtime.setAuth(refreshedToken);
        } catch {
          if (!isClosed) {
            setRealtimeConnected(false);
          }
        }
      })();
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => {
      isClosed = true;
      setRealtimeConnected(false);
      clearInterval(fallbackRefreshTimer);
      clearInterval(tokenRefreshTimer);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [currentUserId, fetchRealtimeAccessToken, refreshMessages]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    void refreshMessages({ conversationId, silent: true });
  };

  const handleSend = async () => {
    if (!selectedConversationId || isSending) {
      return;
    }

    const content = composerText.trim();
    if (!content) {
      return;
    }

    setIsSending(true);
    try {
      const result = await sendTenantMessage({
        conversationId: selectedConversationId,
        content,
      });

      if (!result.ok) {
        throw new Error(result.message || 'Failed to send message.');
      }

      setComposerText('');
      await refreshMessages({ conversationId: selectedConversationId, silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message.';
      showNotice({ type: 'error', message });
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void handleSend();
  };

  const headerSubtitle = isLandlord
    ? 'Live text chat with tenants and enquirers, including read/unread tracking.'
    : 'Live text chat with read/unread status.';
  const sidePanelTitle = isLandlord ? 'Enquiry Leads' : 'Recommended Matches';
  const sideItems = isLandlord ? landlordLeads : tenantRecommendations;

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Flex mb="16px" align="center" justify="space-between">
        <Box>
          <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
            Messages
          </Text>
          <Text fontSize="sm" color={textSecondary}>
            {headerSubtitle}
          </Text>
        </Box>
        <Badge colorScheme={realtimeConnected ? 'green' : 'yellow'} px="10px" py="6px" borderRadius="999px">
          {realtimeConnected ? 'Realtime Connected' : 'Realtime Connecting'}
        </Badge>
      </Flex>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" alignItems="start">
        <Card p="0" bg={cardBg}>
          <Flex px="18px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
            <Text fontSize="md" fontWeight="700" color={textPrimary}>
              Conversations
            </Text>
          </Flex>
          <Box>
            {conversations.length === 0 ? (
              <Box px="18px" py="16px">
                <Text fontSize="sm" color={textSecondary}>
                  No conversations yet.
                </Text>
              </Box>
            ) : (
              conversations.map((item) => {
                const isActive = item.id === selectedConversationId;
                return (
                  <Flex
                    key={item.id}
                    px="18px"
                    py="14px"
                    gap="10px"
                    borderBottom="1px solid"
                    borderColor={borderColor}
                    bg={isActive ? pageBg : 'transparent'}
                    _hover={{ bg: pageBg }}
                    cursor="pointer"
                    onClick={() => handleSelectConversation(item.id)}
                  >
                    <Avatar name={item.title}>{makeInitials(item.title)}</Avatar>
                    <Box flex="1" minW="0">
                      <Flex justify="space-between" align="center">
                        <Text fontSize="sm" fontWeight="600" color={textPrimary} noOfLines={1}>
                          {item.title}
                        </Text>
                        {item.unreadCount > 0 ? (
                          <Badge colorScheme="purple" borderRadius="999px">
                            {item.unreadCount}
                          </Badge>
                        ) : null}
                      </Flex>
                      <Text fontSize="xs" color={textSecondary}>
                        {item.role}
                      </Text>
                      <Text fontSize="sm" color={textSecondary} noOfLines={1}>
                        {item.lastMessage}
                      </Text>
                    </Box>
                  </Flex>
                );
              })
            )}
          </Box>
        </Card>

        <Card p="0" bg={cardBg} gridColumn={{ base: 'auto', xl: 'span 1' }}>
          <Flex px="18px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
            <Text fontSize="md" fontWeight="700" color={textPrimary}>
              {selectedConversation ? `Chat: ${selectedConversation.title}` : 'Chat'}
            </Text>
          </Flex>
          <Flex direction="column" px="18px" py="14px" gap="10px" minH="320px" maxH="480px" overflowY="auto">
            {isLoading && messages.length === 0 ? (
              <Text fontSize="sm" color={textSecondary}>
                Loading messages...
              </Text>
            ) : messages.length === 0 ? (
              <Text fontSize="sm" color={textSecondary}>
                {selectedConversation ? 'No messages yet.' : 'Select a conversation to start chatting.'}
              </Text>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender === 'me';
                const isSystem = msg.sender === 'system';
                return (
                  <Flex key={msg.id} justify={isMine ? 'flex-end' : 'flex-start'}>
                    <Box
                      maxW="88%"
                      px="12px"
                      py="10px"
                      borderRadius="12px"
                      bg={isMine ? mineBg : otherBg}
                      opacity={isSystem ? 0.8 : 1}
                    >
                      <Text fontSize="xs" color={textSecondary} mb="2px">
                        {msg.senderName}
                      </Text>
                      <Text fontSize="sm" color={textPrimary}>
                        {msg.text}
                      </Text>
                      <Text
                        fontSize="xs"
                        mt="4px"
                        color={textSecondary}
                        textAlign={isMine ? 'right' : 'left'}
                      >
                        {formatChatTime(msg.createdAt)}
                      </Text>
                    </Box>
                  </Flex>
                );
              })
            )}
          </Flex>
          <Flex px="18px" pb="16px" gap="8px">
            <Input
              placeholder={selectedConversation ? 'Type a message...' : 'Select a conversation first'}
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={!selectedConversation || isSending}
            />
            <Button
              onClick={() => void handleSend()}
              loading={isSending}
              disabled={!selectedConversation || composerText.trim().length === 0}
              bg={sendButtonBg}
              color="white"
              _hover={{ bg: sendButtonHoverBg }}
              _active={{ bg: sendButtonHoverBg }}
            >
              Send
            </Button>
          </Flex>
          {loadError ? (
            <Box px="18px" pb="14px">
              <Text fontSize="xs" color={textSecondary}>
                {loadError}
              </Text>
            </Box>
          ) : null}
        </Card>

        <Flex direction="column" gap="20px">
          <Card p="0" bg={cardBg}>
            <Flex px="18px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
              <Text fontSize="md" fontWeight="700" color={textPrimary}>
                {sidePanelTitle}
              </Text>
            </Flex>
            <Box p="14px" pt="10px">
              {sideItems.map((item) => (
                <Box key={item.id} py="8px">
                  <Text fontSize="sm" fontWeight="600" color={textPrimary}>
                    {item.label}
                  </Text>
                  <Text fontSize="xs" color={textSecondary}>
                    {item.reason}
                  </Text>
                </Box>
              ))}
            </Box>
          </Card>
        </Flex>
      </SimpleGrid>
    </Box>
  );
}
