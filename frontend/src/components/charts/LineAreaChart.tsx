'use client';
import { BoxProps } from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import LazyChartContainer from './LazyChartContainer';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

type LineAreaChartProps = BoxProps & {
  chartData: any;
  chartOptions: any;
};

const LineAreaChart = ({
  chartData,
  chartOptions,
  minH = '260px',
  ...boxProps
}: LineAreaChartProps) => {
  return (
    <LazyChartContainer minH={minH} {...boxProps}>
      <Chart options={chartOptions} type="area" width="100%" height="100%" series={chartData} />
    </LazyChartContainer>
  );
};

export default LineAreaChart;
