// Chakra imports
import { Flex, Text, useColorModeValue } from 'lib/chakra';

// Custom components
// import { TenantVoiceLogo } from 'components/icons/Icons';
import { HSeparator } from 'components/separator/Separator';

export function SidebarBrand() {
  //   Chakra color mode
  let textColor = useColorModeValue('gray.600', 'whiteAlpha.700');

  return (
    <Flex alignItems="center" flexDirection="column">
      {/* <TenantVoiceLogo h='26px' w='175px' my='32px' color={logoColor} /> */}
      <Text
        fontSize="sm"
        fontWeight="700"
        letterSpacing="0.2em"
        textTransform="uppercase"
        color={textColor}
        mb="20px"
      >
        TenantVoice
      </Text>
      <HSeparator mb="20px" />
    </Flex>
  );
}

export default SidebarBrand;
