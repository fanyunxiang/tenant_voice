import dynamic from 'next/dynamic';
import React from 'react';
import LazyCardSkeleton from 'components/lazy/LazyCardSkeleton';

export const lazyCard = <T extends object>(
  loader: () => Promise<{ default: React.ComponentType<T> }>,
) =>
  dynamic(loader, {
    ssr: false,
    loading: () => <LazyCardSkeleton />,
  });
