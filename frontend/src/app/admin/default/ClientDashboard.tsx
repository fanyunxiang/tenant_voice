'use client';

import { SimpleGrid } from '@chakra-ui/react';
import CheckTable from 'views/admin/default/components/CheckTable';
import ComplexTable from 'views/admin/default/components/ComplexTable';
import DailyTraffic from 'views/admin/default/components/DailyTraffic';
import PieCard from 'views/admin/default/components/PieCard';
import Tasks from 'views/admin/default/components/Tasks';
import TotalSpent from 'views/admin/default/components/TotalSpent';
import WeeklyRevenue from 'views/admin/default/components/WeeklyRevenue';
import tableDataCheck from 'views/admin/default/variables/tableDataCheck';
import tableDataComplex from 'views/admin/default/variables/tableDataComplex';

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
