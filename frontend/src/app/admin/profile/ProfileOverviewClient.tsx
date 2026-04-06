'use client';

import Card from 'components/card/Card';
import { Badge, Box, Button, Flex, Grid, Text, useColorModeValue } from 'lib/chakra';

const requiredIdentity = [
  { id: 'passport', label: 'Passport (50 points)', completed: true },
  { id: 'drivers-licence', label: "Driver's Licence (40 points)", completed: true },
  { id: 'medicare', label: 'Medicare Card (10 points)', completed: false },
];

const optionalProfile = [
  { id: 'about-me', label: 'Written Rental Reference', weight: '5%', completed: true },
  {
    id: 'utility-bill',
    label: 'Utility Bill with Current Address',
    weight: '10%',
    completed: true,
  },
  { id: 'bank-statement', label: 'Bank Statement', weight: '10%', completed: false },
  { id: 'rent-ledger', label: 'Current Tenant Rent Ledger', weight: '10%', completed: false },
];

const completion = {
  requiredCompleted: 50,
  optionalCompleted: 15,
};

export default function ProfileOverviewClient() {
  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const barTrack = useColorModeValue('secondaryGray.200', 'whiteAlpha.200');
  const barFill = useColorModeValue('brand.500', 'brand.300');

  const totalCompletion = completion.requiredCompleted + completion.optionalCompleted;

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Box mb="16px">
        <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
          Profile
        </Text>
        <Text fontSize="sm" color={textSecondary}>
          Manage verification and profile completeness for rental applications (mock data)
        </Text>
      </Box>

      <Grid templateColumns={{ base: '1fr', xl: '1.1fr 1fr' }} gap="16px">
        <Card p="16px" bg={panelBg}>
          <Flex justify="space-between" align="center" mb="8px">
            <Text fontSize="md" fontWeight="700" color={textPrimary}>
              Profile Completeness
            </Text>
            <Badge colorScheme={totalCompletion >= 70 ? 'green' : 'yellow'}>
              {totalCompletion}%
            </Badge>
          </Flex>
          <Text fontSize="sm" color={textSecondary} mb="12px">
            Required ID verification contributes 50%. Optional documents improve trust and ranking.
          </Text>
          <Box h="8px" borderRadius="999px" bg={barTrack} overflow="hidden">
            <Box h="100%" w={`${totalCompletion}%`} bg={barFill} />
          </Box>
          <Flex mt="10px" justify="space-between">
            <Text fontSize="xs" color={textSecondary}>
              Required: {completion.requiredCompleted}%
            </Text>
            <Text fontSize="xs" color={textSecondary}>
              Optional: {completion.optionalCompleted}%
            </Text>
          </Flex>
        </Card>

        <Card p="16px" bg={panelBg}>
          <Text fontSize="md" fontWeight="700" color={textPrimary} mb="8px">
            Tenant Details
          </Text>
          <Text fontSize="sm" color={textSecondary} mb="6px">
            Name: Alex Parker
          </Text>
          <Text fontSize="sm" color={textSecondary} mb="6px">
            Email: alex.parker@example.com
          </Text>
          <Text fontSize="sm" color={textSecondary} mb="12px">
            Preferred area: Parramatta / Strathfield / Burwood
          </Text>
          <Button size="sm" colorScheme="purple">
            Edit Profile
          </Button>
        </Card>
      </Grid>

      <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap="16px" mt="16px">
        <Card p="0" bg={panelBg}>
          <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
            <Text fontWeight="700" color={textPrimary}>
              Required Identity Documents
            </Text>
          </Flex>
          {requiredIdentity.map((item) => (
            <Flex
              key={item.id}
              px="16px"
              py="12px"
              borderBottom="1px solid"
              borderColor={borderColor}
              justify="space-between"
              align="center"
            >
              <Text color={textPrimary} fontSize="sm">
                {item.label}
              </Text>
              <Badge colorScheme={item.completed ? 'green' : 'yellow'}>
                {item.completed ? 'Uploaded' : 'Pending'}
              </Badge>
            </Flex>
          ))}
        </Card>

        <Card p="0" bg={panelBg}>
          <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
            <Text fontWeight="700" color={textPrimary}>
              Optional Trust Documents
            </Text>
          </Flex>
          {optionalProfile.map((item) => (
            <Flex
              key={item.id}
              px="16px"
              py="12px"
              borderBottom="1px solid"
              borderColor={borderColor}
              justify="space-between"
              align="center"
            >
              <Box>
                <Text color={textPrimary} fontSize="sm">
                  {item.label}
                </Text>
                <Text color={textSecondary} fontSize="xs">
                  Weight: {item.weight}
                </Text>
              </Box>
              <Badge colorScheme={item.completed ? 'green' : 'gray'}>
                {item.completed ? 'Uploaded' : 'Not Added'}
              </Badge>
            </Flex>
          ))}
        </Card>
      </Grid>
    </Box>
  );
}
