'use client';
// Chakra imports
import { Box, useColorModeValue } from 'lib/chakra';
// Layout components
import TenantTopNav from 'components/navbar/TenantTopNav';
import { PropsWithChildren, useEffect } from 'react';

interface DashboardLayoutProps extends PropsWithChildren {
  [x: string]: any;
}

// Custom Chakra theme
export default function AdminLayout(props: DashboardLayoutProps) {
  const { children } = props;

  useEffect(() => {
    window.document.documentElement.dir = 'ltr';
  }, []);

  const bg = useColorModeValue('secondaryGray.300', 'navy.900');

  return (
    <Box minH="100vh" w="100%" bg={bg}>
      <TenantTopNav />
      <Box
        w="100%"
        maxW="1280px"
        mx="auto"
        px={{ base: '14px', md: '24px' }}
        pb={{ base: '16px', md: '24px' }}
      >
        <Box mx="auto" minH="calc(100vh - 90px)" pt={{ base: '12px', md: '16px' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
