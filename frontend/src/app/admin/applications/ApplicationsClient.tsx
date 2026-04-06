'use client';

import Card from 'components/card/Card';
import { Badge, Box, Button, Flex, Grid, Text, useColorModeValue } from 'lib/chakra';

type ApplicationStatus = 'Submitted' | 'Under Review' | 'Shortlisted' | 'Approved' | 'Declined';

type RentalApplication = {
  id: string;
  propertyTitle: string;
  suburb: string;
  submittedAt: string;
  status: ApplicationStatus;
  progress: string;
};

const statusToTone: Record<ApplicationStatus, string> = {
  Submitted: 'blue',
  'Under Review': 'yellow',
  Shortlisted: 'purple',
  Approved: 'green',
  Declined: 'red',
};

const activeApplications: RentalApplication[] = [
  {
    id: 'app-1',
    propertyTitle: '2 Bedroom Apartment',
    suburb: 'Parramatta, NSW',
    submittedAt: 'Apr 1, 2026',
    status: 'Under Review',
    progress: 'Waiting for landlord review',
  },
  {
    id: 'app-2',
    propertyTitle: '1 Bedroom Unit',
    suburb: 'Strathfield, NSW',
    submittedAt: 'Mar 28, 2026',
    status: 'Shortlisted',
    progress: 'Shortlist complete, final checks pending',
  },
  {
    id: 'app-3',
    propertyTitle: '2 Bedroom Townhouse',
    suburb: 'Rhodes, NSW',
    submittedAt: 'Mar 24, 2026',
    status: 'Submitted',
    progress: 'Application received',
  },
];

const historyApplications: RentalApplication[] = [
  {
    id: 'hist-1',
    propertyTitle: '1 Bedroom Apartment',
    suburb: 'Burwood, NSW',
    submittedAt: 'Feb 11, 2026',
    status: 'Approved',
    progress: 'Lease offer sent',
  },
  {
    id: 'hist-2',
    propertyTitle: 'Studio Apartment',
    suburb: 'Ashfield, NSW',
    submittedAt: 'Jan 19, 2026',
    status: 'Declined',
    progress: 'Application unsuccessful',
  },
];

const summaryItems = [
  { label: 'Submitted', count: 1 },
  { label: 'Under Review', count: 1 },
  { label: 'Shortlisted', count: 1 },
  { label: 'Approved (History)', count: 1 },
];

export default function ApplicationsClient() {
  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Box mb="16px">
        <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
          Applications
        </Text>
        <Text fontSize="sm" color={textSecondary}>
          Submit rental applications and track progress history (mock data)
        </Text>
      </Box>

      <Grid templateColumns={{ base: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }} gap="12px" mb="16px">
        {summaryItems.map((item) => (
          <Card key={item.label} p="14px" bg={panelBg}>
            <Text fontSize="xs" color={textSecondary} mb="4px">
              {item.label}
            </Text>
            <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
              {item.count}
            </Text>
          </Card>
        ))}
      </Grid>

      <Card p="0" mb="16px" bg={panelBg}>
        <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor} align="center">
          <Text fontSize="md" fontWeight="700" color={textPrimary}>
            Active Applications
          </Text>
        </Flex>
        {activeApplications.map((item) => (
          <Flex
            key={item.id}
            px="16px"
            py="14px"
            borderBottom="1px solid"
            borderColor={borderColor}
            align="center"
            justify="space-between"
            gap="10px"
            wrap="wrap"
          >
            <Box>
              <Text fontWeight="700" color={textPrimary}>
                {item.propertyTitle}
              </Text>
              <Text fontSize="sm" color={textSecondary}>
                {item.suburb} • Submitted {item.submittedAt}
              </Text>
              <Text fontSize="sm" color={textSecondary}>
                {item.progress}
              </Text>
            </Box>
            <Flex align="center" gap="8px">
              <Badge colorScheme={statusToTone[item.status]}>{item.status}</Badge>
              <Button size="sm" variant="outline">
                View
              </Button>
            </Flex>
          </Flex>
        ))}
      </Card>

      <Card p="0" bg={panelBg}>
        <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor} align="center">
          <Text fontSize="md" fontWeight="700" color={textPrimary}>
            Application History
          </Text>
        </Flex>
        {historyApplications.map((item) => (
          <Flex
            key={item.id}
            px="16px"
            py="14px"
            borderBottom="1px solid"
            borderColor={borderColor}
            align="center"
            justify="space-between"
            gap="10px"
            wrap="wrap"
          >
            <Box>
              <Text fontWeight="700" color={textPrimary}>
                {item.propertyTitle}
              </Text>
              <Text fontSize="sm" color={textSecondary}>
                {item.suburb} • Submitted {item.submittedAt}
              </Text>
            </Box>
            <Badge colorScheme={statusToTone[item.status]}>{item.status}</Badge>
          </Flex>
        ))}
      </Card>
    </Box>
  );
}
