import { createSystem, defaultConfig, defineConfig } from 'lib/chakra';
import type { BoxProps } from 'lib/chakra';
import { breakpoints } from './foundations/breakpoints';
import { globalStyles, systemFontStack } from './styles';

const toTokenSchema = (value: unknown): any => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return { value };
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toTokenSchema(nestedValue)]),
    );
  }

  return value;
};

const config = defineConfig({
  theme: {
    breakpoints,
    tokens: {
      colors: toTokenSchema(globalStyles.colors),
      fonts: toTokenSchema({
        heading: systemFontStack,
        body: systemFontStack,
      }),
    },
  },
  globalCss: {
    body: {
      overflowX: 'hidden',
      bg: 'secondaryGray.300',
      _dark: {
        bg: 'navy.900',
      },
      fontFamily: '$fonts.body',
      letterSpacing: '-0.5px',
    },
    input: {
      color: 'gray.700',
    },
    html: {
      fontFamily: '$fonts.body',
    },
  },
});

const system = createSystem(defaultConfig, config);

export default system;

export interface CustomCardProps extends BoxProps {
  size?: string;
  variant?: string;
  [key: string]: any;
}
