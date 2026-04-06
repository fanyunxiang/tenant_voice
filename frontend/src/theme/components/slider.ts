import { mode, StyleFunctionProps } from 'theme/utils';
export const sliderStyles = {
  components: {
    RangeSlider: {
      variants: {
        main: (props: StyleFunctionProps) => ({
          thumb: {
            bg: mode('brand.500', 'brand.400')(props),
          },
        }),
      },
    },
  },
};
