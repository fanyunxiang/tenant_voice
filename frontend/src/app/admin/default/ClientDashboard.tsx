'use client';

import { SimpleGrid } from '@chakra-ui/react';
import { lazyCard } from 'utils/lazyClient';
import tableDataCheck from 'views/admin/default/variables/tableDataCheck';
import tableDataComplex from 'views/admin/default/variables/tableDataComplex';

const CheckTable = lazyCard(
  () => import('views/admin/default/components/CheckTable'),
);
const ComplexTable = lazyCard(
  () => import('views/admin/default/components/ComplexTable'),
);
const DailyTraffic = lazyCard(
  () => import('views/admin/default/components/DailyTraffic'),
);
const PieCard = lazyCard(
  () => import('views/admin/default/components/PieCard'),
);
const Tasks = lazyCard(() => import('views/admin/default/components/Tasks'));
const TotalSpent = lazyCard(
  () => import('views/admin/default/components/TotalSpent'),
);
const WeeklyRevenue = lazyCard(
  () => import('views/admin/default/components/WeeklyRevenue'),
);

export default function ClientDashboard() {
  return (
    <>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px" mb="20px">
        <TotalSpent />
        <WeeklyRevenue />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" mb="20px">
        <CheckTable tableData={tableDataCheck} />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px">
          <DailyTraffic />
          <PieCard />
        </SimpleGrid>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px">
        <ComplexTable tableData={tableDataComplex} />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px">
          <Tasks />
        </SimpleGrid>
      </SimpleGrid>
    </>
  );
}
