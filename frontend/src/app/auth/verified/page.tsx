'use client';

import { Box, Flex, Heading, Spinner, Text } from 'lib/chakra';
import DefaultAuthLayout from 'layouts/auth/Default';
import { APP_DEFAULT_PATH } from 'lib/auth/constants';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function getSafeNextPath(nextPath: string | null) {
  if (
    typeof nextPath === 'string' &&
    nextPath.startsWith('/') &&
    !nextPath.startsWith('//')
  ) {
    return nextPath;
  }
  return APP_DEFAULT_PATH;
}

export default function AuthVerifiedPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = new URLSearchParams(window.location.search);
      const safeNextPath = getSafeNextPath(search.get('next'));
      router.replace(safeNextPath);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <DefaultAuthLayout showBackLink={false}>
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
        <Box
          w="100%"
          border="1px solid"
          borderColor="secondaryGray.300"
          borderRadius="20px"
          p={{ base: '20px', md: '24px' }}
          boxShadow="0 14px 40px rgba(17, 24, 39, 0.06)"
          bg="white"
        >
          <Heading color="navy.700" fontSize={{ base: '30px', md: '34px' }} mb="10px">
            Email verified
          </Heading>
          <Text mb="20px" color="secondaryGray.600" fontWeight="400" fontSize="md">
            Your account is now active. Redirecting to TenantVoice...
          </Text>
          <Flex align="center" gap="10px">
            <Spinner size="sm" color="brand.500" />
            <Text color="secondaryGray.600" fontSize="sm">
              Redirecting in 1 second...
            </Text>
          </Flex>
        </Box>
      </Flex>
    </DefaultAuthLayout>
  );
}
