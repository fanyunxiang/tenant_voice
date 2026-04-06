'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Button, Flex, Icon, Link, useColorMode, useColorModeValue } from 'lib/chakra';
import { IoMdMoon, IoMdSunny } from 'react-icons/io';
import { MdNotificationsNone } from 'react-icons/md';
import { defaultUserRole, roleMenus } from 'variables/roleMenus';

export default function TenantTopNav() {
  const pathname = usePathname();
  const { colorMode, toggleColorMode } = useColorMode();
  const menuItems = roleMenus[defaultUserRole];

  const navBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.400', 'whiteAlpha.100');
  const brandColor = useColorModeValue('navy.700', 'white');
  const itemColor = useColorModeValue('secondaryGray.700', 'secondaryGray.600');
  const itemActiveColor = useColorModeValue('brand.500', 'brand.300');
  const itemActiveBg = useColorModeValue('brand.100', 'whiteAlpha.100');
  const itemHoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const avatarBg = useColorModeValue('brand.500', 'brand.300');

  return (
    <Box
      position="sticky"
      top="0"
      zIndex="sticky"
      bg={navBg}
      borderBottom="1px solid"
      borderColor={borderColor}
      backdropFilter="blur(8px)"
    >
      <Flex
        maxW="1280px"
        mx="auto"
        px={{ base: '14px', md: '24px' }}
        py={{ base: '10px', md: '12px' }}
        align="center"
        gap={{ base: '10px', md: '16px' }}
      >
        <Link
          as={NextLink}
          href="/admin/listings"
          fontWeight="800"
          letterSpacing="0.12em"
          textTransform="uppercase"
          fontSize="sm"
          color={brandColor}
          whiteSpace="nowrap"
        >
          TenantVoice
        </Link>

        <Flex
          flex="1"
          align="center"
          gap={{ base: '10px', md: '15px' }}
          overflowX="auto"
          minW="0"
          sx={{
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {menuItems.map((item) => {
            const isActive = Boolean(item.href && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.id}
                as={NextLink}
                href={item.href}
                px={{ base: '8px', md: '10px' }}
                py="8px"
                borderRadius="10px"
                fontSize="sm"
                fontWeight={isActive ? '700' : '500'}
                color={isActive ? itemActiveColor : itemColor}
                bg={isActive ? itemActiveBg : 'transparent'}
                whiteSpace="nowrap"
                title={item.requirement}
                cursor="pointer"
                transition="transform 0.16s ease, background-color 0.16s ease"
                _hover={{ textDecoration: 'none', bg: itemHoverBg, transform: 'translateY(-1px)' }}
                _focus={{
                  outline: 'none !important',
                  boxShadow: 'none !important',
                  borderColor: 'transparent !important',
                }}
                _focusVisible={{
                  outline: 'none !important',
                  boxShadow: 'none !important',
                  borderColor: 'transparent !important',
                }}
                _active={{
                  outline: 'none !important',
                  boxShadow: 'none !important',
                  borderColor: 'transparent !important',
                }}
                sx={{
                  '&:focus, &:focus-visible, &[data-focus], &[data-focus-visible]': {
                    outline: 'none !important',
                    boxShadow: 'none !important',
                    borderColor: 'transparent !important',
                  },
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </Flex>

        <Button
          variant="ghost"
          minW="36px"
          h="36px"
          p="0"
          borderRadius="50%"
          onClick={toggleColorMode}
          aria-label="Toggle color mode"
          _hover={{ bg: itemHoverBg }}
          _active={{ bg: 'transparent' }}
          _focusVisible={{ outline: 'none', boxShadow: 'none', borderColor: 'transparent' }}
        >
          <Icon as={colorMode === 'light' ? IoMdMoon : IoMdSunny} boxSize="18px" />
        </Button>

        <Button
          variant="ghost"
          minW="36px"
          h="36px"
          p="0"
          borderRadius="50%"
          aria-label="Notifications"
          _hover={{ bg: itemHoverBg }}
          _active={{ bg: 'transparent' }}
          _focusVisible={{ outline: 'none', boxShadow: 'none', borderColor: 'transparent' }}
        >
          <Icon as={MdNotificationsNone} boxSize="18px" />
        </Button>

        <Flex
          w="36px"
          h="36px"
          borderRadius="50%"
          align="center"
          justify="center"
          bg={avatarBg}
          color="white"
          fontSize="xs"
          fontWeight="700"
          flexShrink={0}
          title="Tenant"
        >
          TN
        </Flex>
      </Flex>
    </Box>
  );
}
