import React from 'react';
import { chakra } from 'lib/chakra';
import { CustomCardProps } from 'theme/theme';

const baseCardStyles = {
  p: '20px',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  position: 'relative',
  borderRadius: '20px',
  minWidth: '0px',
  wordWrap: 'break-word',
  bg: '#ffffff',
  _dark: {
    bg: 'navy.800',
  },
  backgroundClip: 'border-box',
};

const CustomCard = React.forwardRef<HTMLDivElement, CustomCardProps>((props, ref) => {
  const { size, variant, ...rest } = props;
  return <chakra.div ref={ref} css={baseCardStyles} {...rest} />;
});

CustomCard.displayName = 'CustomCard';

export default CustomCard;
