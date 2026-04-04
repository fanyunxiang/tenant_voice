'use client';
import { BoxProps } from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import LazyChartContainer from './LazyChartContainer';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

type BarChartProps = BoxProps & {
  chartData: any;
  chartOptions: any;
};

const BarChart = ({ chartData, chartOptions, minH = '260px', ...boxProps }: BarChartProps) => {
  return (
    <LazyChartContainer minH={minH} {...boxProps}>
      <Chart options={chartOptions} type="bar" width="100%" height="100%" series={chartData} />
    </LazyChartContainer>
  );
};

export default BarChart;
