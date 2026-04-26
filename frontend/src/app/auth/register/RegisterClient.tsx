'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
  useColorModeValue,
} from 'lib/chakra';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DefaultAuthLayout from 'layouts/auth/Default';
import { APP_DEFAULT_PATH } from 'lib/auth/constants';
import {
  AuthRole,
  registerAccount,
  resendVerificationCode,
} from 'lib/auth/client';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';

type Step = 'register' | 'email_sent';

const roleOptions: Array<{ value: AuthRole; label: string }> = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'maintenance_worker', label: 'Maintenance Worker' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAVIGATION_FALLBACK_RESET_MS = 5000;
const normalizeEmailInput = (value: string) => value.trim().toLowerCase();

type RegisterClientProps = {
  initialEmail?: string;
  initialStep?: Step;
  nextPath?: string;
};

export default function RegisterClient({
  initialEmail,
  initialStep = 'register',
  nextPath,
}: RegisterClientProps) {
  const router = useRouter();
  const redirectTarget = useMemo(() => nextPath || APP_DEFAULT_PATH, [nextPath]);
  const normalizedInitialEmail = useMemo(
    () => normalizeEmailInput(initialEmail ?? ''),
    [initialEmail],
  );
  const { showNotice } = useGlobalNotice();
  const navigationResetTimerRef = useRef<number | null>(null);

  const [step, setStep] = useState<Step>(
    initialStep === 'email_sent' && normalizedInitialEmail ? 'email_sent' : 'register',
  );
  const [email, setEmail] = useState(normalizedInitialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AuthRole>('tenant');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

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

  const getVerificationPath = (verificationEmail: string) => {
    const params = new URLSearchParams({
      step: 'verify',
      email: verificationEmail,
    });

    if (nextPath) {
      params.set('next', nextPath);
    }

    return `/auth/register?${params.toString()}`;
  };

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

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmailInput(email);

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      showNotice({ type: 'error', message: 'Email format is invalid.' });
      return;
    }

    if (password.length < 8) {
      showNotice({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }

    if (password !== confirmPassword) {
      showNotice({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerAccount({
        email: normalizedEmail,
        password,
        confirmPassword,
        fullName,
        role,
      });

      if (result.verificationRequired === false) {
        showNotice({ type: 'success', message: result.message || 'Account created.' });
        replaceWithFallback();
        return;
      }

      setEmail(normalizedEmail);
      setStep('email_sent');
      router.replace(getVerificationPath(normalizedEmail));
      showNotice({
        type: 'success',
        message:
          result.message ||
          'Registration submitted. Please check your email.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register.';
      showNotice({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    const normalizedEmail = normalizeEmailInput(email);

    if (!normalizedEmail) {
      showNotice({ type: 'error', message: 'Email is required before resending a code.' });
      return;
    }

    setIsResending(true);

    try {
      const result = await resendVerificationCode({ email: normalizedEmail });
      showNotice({
        type: 'success',
        message: result.message || 'A new verification email has been sent.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to resend code.';
      showNotice({ type: 'error', message });
    } finally {
      setIsResending(false);
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
          <Heading
            color={textColor}
            fontSize={{ base: '34px', md: '38px' }}
            mb={step === 'register' ? '10px' : '32px'}
          >
            {step === 'register' ? 'Create Account' : 'Verification Link Sent'}
          </Heading>
          {step === 'register' ? (
            <Text mb="32px" color={textColorSecondary} fontWeight="400" fontSize="md">
              Register as Tenant, Landlord, or Maintenance Worker.
            </Text>
          ) : null}
        </Box>

        <Box
          w="100%"
          maxW="100%"
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="20px"
          p={{ base: '20px', md: '24px' }}
          boxShadow="0 14px 40px rgba(17, 24, 39, 0.06)"
        >
          {step === 'register' ? (
            <Box as="form" onSubmit={handleRegister}>
              <FormControl>
                <FormLabel mb="8px" fontSize="sm" fontWeight="600" color={textColor}>
                  Full Name
                </FormLabel>
                <Input
                  fontSize="sm"
                  type="text"
                  placeholder="Alex Tenant"
                  mb="20px"
                  size="lg"
                  value={fullName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setFullName(event.target.value)}
                  autoComplete="name"
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
                  Email
                </FormLabel>
                <Input
                  required
                  fontSize="sm"
                  type="email"
                  placeholder="hello@tenantvoice.app"
                  mb="20px"
                  size="lg"
                  value={email}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
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
                  type="password"
                  placeholder="Min. 8 characters"
                  mb="20px"
                  size="lg"
                  value={password}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                  autoComplete="new-password"
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
                  Confirm Password
                </FormLabel>
                <Input
                  required
                  fontSize="sm"
                  type="password"
                  placeholder="Re-enter your password"
                  mb="20px"
                  size="lg"
                  value={confirmPassword}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
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
                  Role
                </FormLabel>
                <Box
                  as="select"
                  mb="24px"
                  h="50px"
                  w="100%"
                  borderRadius="14px"
                  px="14px"
                  bg={inputBg}
                  border="1px solid"
                  borderColor={inputBorder}
                  value={role}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setRole(event.target.value as AuthRole)
                  }
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Box>

                <Button
                  type="submit"
                  fontSize="sm"
                  fontWeight="600"
                  w="100%"
                  h="50px"
                  mb="18px"
                  isLoading={isSubmitting}
                  loadingText="Registering"
                  isDisabled={isSubmitting || isResending}
                  bg={primaryButtonBg}
                  color="white"
                  _hover={{ bg: primaryButtonHoverBg }}
                  _active={{ bg: primaryButtonHoverBg }}
                >
                  Register
                </Button>
              </FormControl>
            </Box>
          ) : (
            <Box>
              <FormControl>
                <Text mb="10px" fontSize="md" color={textColor}>
                  We sent a verification link to <Text as="span" fontWeight="700">{email}</Text>.
                </Text>

                <Button
                  type="button"
                  fontSize="sm"
                  fontWeight="600"
                  w="100%"
                  h="50px"
                  mb="12px"
                  onClick={handleResendCode}
                  isLoading={isResending}
                  loadingText="Resending"
                  isDisabled={isResending}
                  variant="outline"
                  borderColor={inputBorder}
                >
                  Resend Verification Email
                </Button>
                <Text mb="12px" fontSize="xs" color={textColorSecondary}>
                  If you resend too frequently, email providers may temporarily rate limit delivery.
                </Text>
              </FormControl>
            </Box>
          )}

          <Flex justifyContent="center" alignItems="center" mt="8px">
            <Link href="/auth/sign-in">
              <Text color={textColorDetails} fontWeight="400" fontSize="14px">
                Already registered?
                <Text color={textColorBrand} as="span" ms="5px" fontWeight="600">
                  Sign in
                </Text>
              </Text>
            </Link>
          </Flex>
        </Box>
      </Flex>
    </DefaultAuthLayout>
  );
}
