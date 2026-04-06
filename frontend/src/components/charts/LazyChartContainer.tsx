'use client';

import { Box, BoxProps, Skeleton } from 'lib/chakra';
import { PropsWithChildren, useEffect, useRef, useState } from 'react';

type LazyChartContainerProps = BoxProps & {
  /**
   * Distance in px at which the chart should start loading
   * before it actually enters the viewport.
   */
  rootMargin?: string;
};

const LazyChartContainer = ({
  children,
  minH = '260px',
  rootMargin = '0px',
  ...boxProps
}: PropsWithChildren<LazyChartContainerProps>) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return;
    const node = ref.current;
    if (!node) return;
    if (
      typeof window === 'undefined' ||
      document.visibilityState === 'hidden' ||
      !('IntersectionObserver' in window)
    ) {
      // We intentionally reveal content post-hydration when observer APIs are unavailable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, isVisible]);

  return (
    <Box ref={ref} minH={minH} position="relative" w="100%" {...boxProps}>
      {isVisible ? (
        children
      ) : (
        <Skeleton
          position="absolute"
          inset={0}
          startColor="secondaryGray.200"
          endColor="secondaryGray.300"
          borderRadius="20px"
          minH={minH}
        />
      )}
    </Box>
  );
};

export default LazyChartContainer;
