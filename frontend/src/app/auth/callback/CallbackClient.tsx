'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Flex, Heading, Spinner, Text, useColorModeValue } from 'lib/chakra';
import DefaultAuthLayout from 'layouts/auth/Default';
import { APP_DEFAULT_PATH } from 'lib/auth/constants';
import { createSessionFromEmailLink } from 'lib/auth/client';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Completing email verification...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectTarget = useMemo(() => {
    const nextPath = searchParams.get('next');
    return nextPath || APP_DEFAULT_PATH;
  }, [searchParams]);

  const textColor = useColorModeValue('navy.700', 'white');
  const secondaryTextColor = useColorModeValue('secondaryGray.600', 'secondaryGray.400');
  const errorColor = useColorModeValue('red.500', 'red.300');
  const cardBorderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.200');
  const cardBg = useColorModeValue('white', 'navy.900');

  useEffect(() => {
    const completeAuth = async () => {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const expiresInRaw = params.get('expires_in');
      const expiresIn = expiresInRaw ? Number(expiresInRaw) : undefined;

      if (!accessToken || !refreshToken) {
        setErrorMessage('Invalid confirmation link. Please request a new verification email.');
        return;
      }

      try {
        await createSessionFromEmailLink({
          accessToken,
          refreshToken,
          expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
        });
        setMessage('Email verified. Redirecting to success page...');
        const target = `/auth/verified?next=${encodeURIComponent(redirectTarget)}`;
        router.replace(target);
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : 'Unable to finish email verification.';
        setErrorMessage(messageText);
      }
    };

    void completeAuth();
  }, [redirectTarget, router]);

  return (
    <DefaultAuthLayout>
      <Flex
        maxW={{ base: '100%', md: '460px' }}
        w="100%"
        mx={{ base: 'auto', lg: '0px' }}
        me="auto"
        h="100%"
        alignItems="start"
        justifyContent="center"
        mb={{ base: '24px', md: '48px' }}
        px={{ base: '20px', md: '0px' }}
        mt={{ base: '32px', md: '12vh' }}
        flexDirection="column"
      >
        <Box me="auto">
          <Heading color={textColor} fontSize={{ base: '30px', md: '34px' }} mb="10px">
            Confirming account
          </Heading>
          <Text mb="24px" color={secondaryTextColor} fontWeight="400" fontSize="md">
            We are validating your email link.
          </Text>
        </Box>

        <Box
          w="100%"
          border="1px solid"
          borderColor={cardBorderColor}
          borderRadius="20px"
          p={{ base: '20px', md: '24px' }}
          boxShadow="0 14px 40px rgba(17, 24, 39, 0.06)"
          bg={cardBg}
        >
          {errorMessage ? (
            <Text color={errorColor} fontSize="sm">
              {errorMessage}
            </Text>
          ) : (
            <Flex alignItems="center" gap="10px">
              <Spinner size="sm" />
              <Text color={textColor} fontSize="sm">
                {message}
              </Text>
            </Flex>
          )}
        </Box>
      </Flex>
    </DefaultAuthLayout>
  );
}
