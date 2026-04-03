'use client';

import { Box, SimpleGrid } from '@chakra-ui/react';
import { lazyCard } from 'utils/lazyClient';
import tableDataDevelopment from 'views/admin/dataTables/variables/tableDataDevelopment';
import tableDataCheck from 'views/admin/dataTables/variables/tableDataCheck';
import tableDataColumns from 'views/admin/dataTables/variables/tableDataColumns';
import tableDataComplex from 'views/admin/dataTables/variables/tableDataComplex';

const DevelopmentTable = lazyCard(
  () => import('views/admin/dataTables/components/DevelopmentTable'),
);
const CheckTable = lazyCard(
  () => import('views/admin/dataTables/components/CheckTable'),
);
const ColumnsTable = lazyCard(
  () => import('views/admin/dataTables/components/ColumnsTable'),
);
const ComplexTable = lazyCard(
  () => import('views/admin/dataTables/components/ComplexTable'),
);

export default function DataTablesPage() {
  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <SimpleGrid
        mb="20px"
        columns={{ sm: 1, md: 2 }}
        spacing={{ base: '20px', xl: '20px' }}
      >
        <DevelopmentTable tableData={tableDataDevelopment} />
        <CheckTable tableData={tableDataCheck} />
        <ColumnsTable tableData={tableDataColumns} />
        <ComplexTable tableData={tableDataComplex} />
      </SimpleGrid>
    </Box>
  );
}
