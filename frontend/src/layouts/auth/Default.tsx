'use client';

// Chakra imports
import { Box, Flex, Icon, useColorModeValue, Text } from 'lib/chakra';
import Footer from 'components/footer/FooterAuth';
// Assets
import { FaChevronLeft } from 'react-icons/fa';
import Link from 'next/link';
import { ReactNode } from 'react';

function AuthIllustration(props: { children: ReactNode; showBackLink?: boolean }) {
  const authBg = useColorModeValue('white', 'navy.900');
  const panelGradient = useColorModeValue(
    'linear-gradient(135deg, #6A5AF9 0%, #4F46E5 45%, #2E22B7 100%)',
    'linear-gradient(135deg, #4338CA 0%, #312E81 50%, #1E1B4B 100%)',
  );
  const { children, showBackLink = true } = props;
  // Chakra color mode
  return (
    <Flex minW="100vh" w="100%" bg={authBg} position="relative" h="max-content">
      <Flex
        h={{
          sm: 'initial',
          md: 'unset',
          lg: '100vh',
          xl: '100vh',
        }}
        w={{ base: '100vw', md: '100%' }}
        maxW={{ md: '66%', lg: '1313px' }}
        mx={{ md: 'auto' }}
        pt={{ sm: '50px', md: '0px' }}
        px={{ lg: '30px', xl: '0px' }}
        ps={{ xl: '70px' }}
        justifyContent="start"
        direction="column"
      >
        {showBackLink ? (
          <Link
            href="/"
            style={{
              width: 'fit-content',
              marginTop: '40px',
            }}
          >
            <Flex
              align="center"
              ps={{ base: '25px', lg: '0px' }}
              pt={{ lg: '0px', xl: '0px' }}
              w="fit-content"
            >
              <Icon as={FaChevronLeft} me="12px" h="13px" w="8px" color="secondaryGray.600" />
              <Text ms="0px" fontSize="sm" color="secondaryGray.600">
                Back to TenantVoice
              </Text>
            </Flex>
          </Link>
        ) : null}
        {children}
        <Box
          display={{ base: 'none', md: 'block' }}
          h="100%"
          minH="100vh"
          w={{ lg: '50vw', '2xl': '44vw' }}
          position="absolute"
          right="0px"
        >
          <Flex
            bgImage={panelGradient}
            justify="center"
            align="center"
            w="100%"
            h="100%"
            position="absolute"
            borderBottomLeftRadius={{ lg: '120px', xl: '200px' }}
            px={{ lg: '40px', xl: '56px' }}
          />
          <Flex
            position="relative"
            w="100%"
            h="100%"
            align="center"
            justify="center"
            borderBottomLeftRadius={{ lg: '120px', xl: '200px' }}
            px={{ lg: '40px', xl: '56px' }}
          >
            <Box textAlign="center" color="white">
              <Text fontSize={{ lg: '48px', xl: '56px' }} fontWeight="800" letterSpacing="0.08em">
                TENANTVOICE
              </Text>
              <Text mt="16px" fontSize={{ lg: '16px', xl: '18px' }} opacity={0.9}>
                Find rentals faster. Apply smarter. Live better.
              </Text>
            </Box>
          </Flex>
        </Box>
        <Footer mb={{ xl: '3vh' }} />
      </Flex>
    </Flex>
  );
}

export default AuthIllustration;
