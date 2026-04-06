'use client';

import { SimpleGrid } from 'lib/chakra';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import LazyCardSkeleton from 'components/lazy/LazyCardSkeleton';
import CheckTable from 'views/admin/default/components/CheckTable';
import ComplexTable from 'views/admin/default/components/ComplexTable';
import Tasks from 'views/admin/default/components/Tasks';
import tableDataCheck from 'views/admin/default/variables/tableDataCheck';
import tableDataComplex from 'views/admin/default/variables/tableDataComplex';

const TotalSpent = dynamic(() => import('views/admin/default/components/TotalSpent'), {
  ssr: false,
  loading: () => <LazyCardSkeleton />,
});
const WeeklyRevenue = dynamic(() => import('views/admin/default/components/WeeklyRevenue'), {
  ssr: false,
  loading: () => <LazyCardSkeleton />,
});
const DailyTraffic = dynamic(() => import('views/admin/default/components/DailyTraffic'), {
  ssr: false,
  loading: () => <LazyCardSkeleton />,
});
const PieCard = dynamic(() => import('views/admin/default/components/PieCard'), {
  ssr: false,
  loading: () => <LazyCardSkeleton />,
});

export default function ClientDashboard() {
  const [enableCharts, setEnableCharts] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setEnableCharts(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px" mb="20px">
        {enableCharts ? <TotalSpent /> : <LazyCardSkeleton />}
        {enableCharts ? <WeeklyRevenue /> : <LazyCardSkeleton />}
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" mb="20px">
        <CheckTable tableData={tableDataCheck} />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px">
          {enableCharts ? <DailyTraffic /> : <LazyCardSkeleton />}
          {enableCharts ? <PieCard /> : <LazyCardSkeleton />}
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
