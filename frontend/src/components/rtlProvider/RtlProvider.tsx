'use client';

import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtl from 'stylis-plugin-rtl';
import { ReactNode } from 'react';

const rtlCache = createCache({
  key: 'css-ar',
  stylisPlugins: [rtl],
});

const ltrCache = createCache({
  key: 'css-en',
});

interface RtlProviderProps {
  children: ReactNode;
  dir?: 'rtl' | 'ltr';
}

export function RtlProvider({ children, dir = 'rtl' }: RtlProviderProps) {
  const cache = dir === 'rtl' ? rtlCache : ltrCache;
  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
