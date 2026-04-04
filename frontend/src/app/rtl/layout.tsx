'use client';
// Chakra imports
import { Portal, Box, useDisclosure } from '@chakra-ui/react';
import Footer from 'components/footer/FooterAdmin';
// Layout components
import Navbar from 'components/navbar/NavbarRTL';
import Sidebar from 'components/sidebar/Sidebar';
import { RtlProvider } from 'components/rtlProvider/RtlProvider';
import { PropsWithChildren, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import routes from 'routes';
import { getActiveNavbar, getActiveNavbarText, getActiveRoute } from 'utils/navigation';

interface RTLLayoutProps extends PropsWithChildren {}

// Custom Chakra theme
export default function RTLLayout(props: RTLLayoutProps) {
  const { children, ...rest } = props;
  const fixed = false;
  const pathname = usePathname();

  const brandText = getActiveRoute(routes, pathname);
  const secondary = getActiveNavbar(routes, pathname);
  const message = getActiveNavbarText(routes, pathname);

  useEffect(() => {
    document.documentElement.dir = 'rtl';
  }, []);

  const { onOpen } = useDisclosure();
  return (
    <RtlProvider dir="rtl">
      <Box>
        <Sidebar routes={routes} display="none" {...rest} />
        <Box
          float="left"
          minHeight="100vh"
          height="100%"
          overflow="auto"
          position="relative"
          maxHeight="100%"
          w={{ base: '100%', xl: 'calc( 100% - 290px )' }}
          maxWidth={{ base: '100%', xl: 'calc( 100% - 290px )' }}
          transition="all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)"
          transitionDuration=".2s, .2s, .35s"
          transitionProperty="top, bottom, width"
          transitionTimingFunction="linear, linear, ease"
        >
          <Portal>
            <Box>
              <Navbar
                onOpen={onOpen}
                logoText={'TenantVoice Dashboard'}
                brandText={brandText}
                secondary={secondary}
                message={message}
                fixed={fixed}
                {...rest}
              />
            </Box>
          </Portal>

          <Box mx="auto" p={{ base: '20px', md: '30px' }} pe="20px" minH="100vh" pt="50px">
            {children}
          </Box>
          <Box>
            <Footer />
          </Box>
        </Box>
      </Box>
    </RtlProvider>
  );
}
