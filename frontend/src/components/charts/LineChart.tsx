'use client';
import { BoxProps } from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import LazyChartContainer from './LazyChartContainer';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

type LineChartProps = BoxProps & {
  chartData: any;
  chartOptions: any;
};

const LineChart = ({
  chartData,
  chartOptions,
  minH = '260px',
  ...boxProps
}: LineChartProps) => {
  return (
    <LazyChartContainer minH={minH} {...boxProps}>
      <Chart
        options={chartOptions}
        type="line"
        width="100%"
        height="100%"
        series={chartData}
      />
    </LazyChartContainer>
  );
};

export default LineChart;
