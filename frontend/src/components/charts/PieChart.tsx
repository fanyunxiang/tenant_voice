'use client';
import { BoxProps } from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import LazyChartContainer from './LazyChartContainer';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

type PieChartProps = BoxProps & {
  chartData: any;
  chartOptions: any;
};

const PieChart = ({
  chartData,
  chartOptions,
  minH = '260px',
  ...boxProps
}: PieChartProps) => {
  return (
    <LazyChartContainer minH={minH} {...boxProps}>
      <Chart
        options={chartOptions}
        type="pie"
        width="100%"
        height="100%"
        series={chartData}
      />
    </LazyChartContainer>
  );
};

export default PieChart;
