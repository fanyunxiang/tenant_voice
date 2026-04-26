'use client';

import {
  Box,
  Flex,
  Icon,
  Portal,
  Text,
  useColorModeValue,
} from 'lib/chakra';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi';

export type NoticeType = 'success' | 'error' | 'info';

type GlobalNotice = {
  id: number;
  type: NoticeType;
  message: string;
  durationMs: number;
};

type ShowNoticeInput = {
  type: NoticeType;
  message: string;
  durationMs?: number;
};

type GlobalNoticeContextValue = {
  showNotice: (input: ShowNoticeInput) => void;
};

const GlobalNoticeContext = createContext<GlobalNoticeContextValue | null>(null);

function getNoticeColors(type: NoticeType) {
  if (type === 'success') {
    return {
      bgLight: 'green.50',
      bgDark: 'green.900',
      borderLight: 'green.200',
      borderDark: 'green.600',
      iconLight: 'green.500',
      iconDark: 'green.200',
    };
  }

  if (type === 'error') {
    return {
      bgLight: 'red.50',
      bgDark: 'red.900',
      borderLight: 'red.200',
      borderDark: 'red.600',
      iconLight: 'red.500',
      iconDark: 'red.200',
    };
  }

  return {
    bgLight: 'blue.50',
    bgDark: 'blue.900',
    borderLight: 'blue.200',
    borderDark: 'blue.600',
    iconLight: 'blue.500',
    iconDark: 'blue.200',
  };
}

function NoticeToast({ notice }: { notice: GlobalNotice | null }) {
  const noticeType: NoticeType = notice?.type ?? 'info';
  const colors = getNoticeColors(noticeType);
  const textColor = useColorModeValue('gray.800', 'white');
  const bg = useColorModeValue(colors.bgLight, colors.bgDark);
  const borderColor = useColorModeValue(colors.borderLight, colors.borderDark);
  const iconColor = useColorModeValue(colors.iconLight, colors.iconDark);

  if (!notice) {
    return null;
  }

  const NoticeIcon = notice.type === 'success' ? FiCheckCircle : notice.type === 'error' ? FiAlertCircle : FiInfo;

  return (
    <Portal>
      <Box
        position="fixed"
        top={{ base: '16px', md: '24px' }}
        left="50%"
        transform="translateX(-50%)"
        zIndex={1900}
        pointerEvents="none"
      >
        <Flex
          w={{ base: 'calc(100vw - 32px)', md: '520px' }}
          maxW={{ base: 'calc(100vw - 32px)', md: '520px' }}
          borderWidth="1px"
          borderColor={borderColor}
          bg={bg}
          borderRadius="16px"
          px={{ base: '16px', md: '18px' }}
          py={{ base: '14px', md: '16px' }}
          alignItems="center"
          gap="12px"
          boxShadow="0 16px 32px rgba(15, 23, 42, 0.18)"
        >
          <Icon as={NoticeIcon} boxSize={{ base: '20px', md: '22px' }} color={iconColor} flexShrink={0} />
          <Text color={textColor} fontSize={{ base: 'sm', md: 'md' }} fontWeight="600" lineHeight="1.45">
            {notice.message}
          </Text>
        </Flex>
      </Box>
    </Portal>
  );
}

export function GlobalNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<GlobalNotice | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((input: ShowNoticeInput) => {
    const durationMs = input.durationMs ?? 2800;
    const nextNotice: GlobalNotice = {
      id: Date.now(),
      type: input.type,
      message: input.message,
      durationMs,
    };

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setNotice(nextNotice);

    timeoutRef.current = setTimeout(() => {
      setNotice((current) => (current?.id === nextNotice.id ? null : current));
      timeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <GlobalNoticeContext.Provider value={{ showNotice }}>
      {children}
      <NoticeToast notice={notice} />
    </GlobalNoticeContext.Provider>
  );
}

export function useGlobalNotice() {
  const context = useContext(GlobalNoticeContext);
  if (!context) {
    throw new Error('useGlobalNotice must be used within GlobalNoticeProvider.');
  }

  return context;
}
