'use client';
// chakra imports
import { Box, Flex, HStack, Text, useColorModeValue } from 'lib/chakra';
import Link from 'next/link';
import { IRoute } from 'types/navigation';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

interface SidebarLinksProps {
  routes: IRoute[];
}

export function SidebarLinks(props: SidebarLinksProps) {
  const { routes } = props;
  const router = useRouter();
  const prefetchedRoutesRef = useRef(new Set<string>());

  //   Chakra color mode
  const pathname = usePathname();

  let activeColor = useColorModeValue('gray.700', 'white');
  let inactiveColor = useColorModeValue('secondaryGray.600', 'secondaryGray.600');
  let activeIcon = useColorModeValue('brand.500', 'white');
  let textColor = useColorModeValue('secondaryGray.500', 'white');
  let brandColor = useColorModeValue('brand.500', 'brand.400');

  // verifies if routeName is the one active (in browser input)
  const activeRoute = useCallback(
    (layout: string, path: string) => {
      if (!pathname) return false;
      return pathname.startsWith(layout + path);
    },
    [pathname],
  );

  const prefetchOnIntent = useCallback(
    (href: string) => {
      if (prefetchedRoutesRef.current.has(href)) return;
      prefetchedRoutesRef.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

  // this function creates the links from the secondary accordions (for example auth -> sign-in -> default)
  const createLinks = (routes: IRoute[]) => {
    return routes.map((route, index: number) => {
      if (route.layout === '/admin' || route.layout === '/auth' || route.layout === '/rtl') {
        const href = route.layout + route.path;
        const isActive = activeRoute(route.layout, route.path);
        return (
          <Link
            key={index}
            href={href}
            prefetch={false}
            onMouseEnter={() => prefetchOnIntent(href)}
            onFocus={() => prefetchOnIntent(href)}
          >
            {route.icon ? (
              <Box>
                <HStack spacing={isActive ? '22px' : '26px'} py="5px" ps="10px">
                  <Flex w="100%" alignItems="center" justifyContent="center">
                    <Box color={isActive ? activeIcon : textColor} me="18px">
                      {route.icon}
                    </Box>
                    <Text
                      me="auto"
                      color={isActive ? activeColor : textColor}
                      fontWeight={isActive ? 'bold' : 'normal'}
                    >
                      {route.name}
                    </Text>
                  </Flex>
                  <Box
                    h="36px"
                    w="4px"
                    bg={isActive ? brandColor : 'transparent'}
                    borderRadius="5px"
                  />
                </HStack>
              </Box>
            ) : (
              <Box>
                <HStack spacing={isActive ? '22px' : '26px'} py="5px" ps="10px">
                  <Text
                    me="auto"
                    color={isActive ? activeColor : inactiveColor}
                    fontWeight={isActive ? 'bold' : 'normal'}
                  >
                    {route.name}
                  </Text>
                  <Box h="36px" w="4px" bg="brand.400" borderRadius="5px" />
                </HStack>
              </Box>
            )}
          </Link>
        );
      }
    });
  };
  //  BRAND
  return <>{createLinks(routes)}</>;
}

export default SidebarLinks;
