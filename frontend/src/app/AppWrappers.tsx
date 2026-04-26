'use client';
import React, { ReactNode } from 'react';
import 'styles/App.css';
import 'styles/Contact.css';
import 'styles/MiniCalendar.css';
import { ChakraProvider } from 'lib/chakra';
import { ThemeProvider } from 'next-themes';
import theme from '../theme/theme';
import { GlobalNoticeProvider } from 'components/feedback/GlobalNoticeProvider';

export default function AppWrappers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ChakraProvider value={theme}>
        <GlobalNoticeProvider>{children}</GlobalNoticeProvider>
      </ChakraProvider>
    </ThemeProvider>
  );
}
