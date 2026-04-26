'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Flex, FormControl, FormLabel, Heading, Input, Text, useColorModeValue } from 'lib/chakra';
import DefaultAuthLayout from 'layouts/auth/Default';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { APP_DEFAULT_PATH } from 'lib/auth/constants';
import { login } from 'lib/auth/client';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';

type SignInClientProps = {
  nextPath?: string;
};

const NAVIGATION_FALLBACK_RESET_MS = 5000;

export default function SignInClient({ nextPath }: SignInClientProps) {
  const router = useRouter();
  const redirectTarget = useMemo(() => nextPath || APP_DEFAULT_PATH, [nextPath]);
  const { showNotice } = useGlobalNotice();
  const navigationResetTimerRef = useRef<number | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textColor = useColorModeValue('navy.700', 'white');
  const textColorSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.400');
  const textColorDetails = useColorModeValue('navy.700', 'secondaryGray.600');
  const textColorBrand = useColorModeValue('brand.500', 'white');
  const requiredColor = useColorModeValue('red.500', 'red.300');
  const inputBg = useColorModeValue('white', 'navy.800');
  const inputBorder = useColorModeValue('secondaryGray.300', 'whiteAlpha.300');
  const inputPlaceholder = useColorModeValue('secondaryGray.500', 'secondaryGray.400');
  const inputFocusBorder = useColorModeValue('brand.500', 'brand.300');
  const cardBg = useColorModeValue('white', 'navy.900');
  const cardBorder = useColorModeValue('secondaryGray.300', 'whiteAlpha.200');
  const primaryButtonBg = useColorModeValue('brand.500', 'brand.300');
  const primaryButtonHoverBg = useColorModeValue('brand.600', 'brand.400');

  useEffect(() => {
    return () => {
      if (navigationResetTimerRef.current) {
        window.clearTimeout(navigationResetTimerRef.current);
      }
    };
  }, []);

  const replaceWithFallback = () => {
    if (navigationResetTimerRef.current) {
      window.clearTimeout(navigationResetTimerRef.current);
    }

    router.replace(redirectTarget);
    navigationResetTimerRef.current = window.setTimeout(() => {
      setIsSubmitting(false);
      navigationResetTimerRef.current = null;
    }, NAVIGATION_FALLBACK_RESET_MS);
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login({ email, password });
      showNotice({ type: 'success', message: 'Signed in successfully. Redirecting...' });
      replaceWithFallback();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      showNotice({ type: 'error', message });
      setIsSubmitting(false);
    }
  };

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
          <Heading color={textColor} fontSize={{ base: '34px', md: '38px' }} mb="10px">
            Sign In
          </Heading>
          <Text mb="32px" color={textColorSecondary} fontWeight="400" fontSize="md">
            Use your email and password to continue.
          </Text>
        </Box>

        <Box
          as="form"
          onSubmit={handleSignIn}
          w="100%"
          maxW="100%"
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="20px"
          p={{ base: '20px', md: '24px' }}
          boxShadow="0 14px 40px rgba(17, 24, 39, 0.06)"
        >
          <FormControl>
            <FormLabel display="flex" alignItems="center" mb="8px" fontSize="sm" fontWeight="600" color={textColor}>
              <Text as="span" color={requiredColor} me="6px">
                *
              </Text>
              Email
            </FormLabel>
            <Input
              required
              fontSize="sm"
              type="email"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              placeholder="hello@tenantvoice.app"
              mb="20px"
              size="lg"
              autoComplete="email"
              bg={inputBg}
              border="1px solid"
              borderColor={inputBorder}
              borderRadius="14px"
              h="50px"
              _placeholder={{ color: inputPlaceholder }}
              _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
            />

            <FormLabel display="flex" alignItems="center" mb="8px" fontSize="sm" fontWeight="600" color={textColor}>
              <Text as="span" color={requiredColor} me="6px">
                *
              </Text>
              Password
            </FormLabel>
            <Input
              required
              fontSize="sm"
              placeholder="Min. 8 characters"
              mb="22px"
              size="lg"
              type="password"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              autoComplete="current-password"
              bg={inputBg}
              border="1px solid"
              borderColor={inputBorder}
              borderRadius="14px"
              h="50px"
              _placeholder={{ color: inputPlaceholder }}
              _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
            />

            <Button
              type="submit"
              fontSize="sm"
              fontWeight="600"
              w="100%"
              h="50px"
              mb="18px"
              isLoading={isSubmitting}
              loadingText="Signing in"
              isDisabled={isSubmitting}
              bg={primaryButtonBg}
              color="white"
              _hover={{ bg: primaryButtonHoverBg }}
              _active={{ bg: primaryButtonHoverBg }}
            >
              Sign In
            </Button>
          </FormControl>

          <Flex justifyContent="center" alignItems="center">
            <Link href="/auth/register">
              <Text color={textColorDetails} fontWeight="400" fontSize="14px">
                Need an account?
                <Text color={textColorBrand} as="span" ms="5px" fontWeight="600">
                  Register now
                </Text>
              </Text>
            </Link>
          </Flex>
        </Box>
      </Flex>
    </DefaultAuthLayout>
  );
}
