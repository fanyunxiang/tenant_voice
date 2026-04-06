'use client';

import { Box } from 'lib/chakra';
import ClientDashboard from './ClientDashboard';
import StatsSection from './components/StatsSection';

export default function DefaultPage() {
  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <StatsSection />
      <ClientDashboard />
    </Box>
  );
}
