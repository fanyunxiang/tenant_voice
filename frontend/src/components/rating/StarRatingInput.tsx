'use client';

import { Box, Flex, Text, useColorModeValue } from 'lib/chakra';
import { IoStar, IoStarHalf, IoStarOutline } from 'react-icons/io5';

type StarRatingInputProps = {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: number;
  showValue?: boolean;
};

function clamp(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(5, Math.max(0, Math.round(value * 2) / 2));
}

function iconForStar(value: number, starIndex: number) {
  if (value >= starIndex) {
    return IoStar;
  }

  if (value >= starIndex - 0.5) {
    return IoStarHalf;
  }

  return IoStarOutline;
}

export default function StarRatingInput({
  value,
  onChange,
  readOnly = false,
  size = 24,
  showValue = true,
}: StarRatingInputProps) {
  const normalizedValue = clamp(value);
  const activeColor = useColorModeValue('orange.400', 'orange.300');
  const mutedColor = useColorModeValue('secondaryGray.400', 'secondaryGray.500');

  const stars = [1, 2, 3, 4, 5];

  return (
    <Flex align="center" gap="10px" wrap="wrap">
      <Flex align="center" gap="6px">
        {stars.map((starIndex) => {
          const Icon = iconForStar(normalizedValue, starIndex);
          const hasActive = normalizedValue >= starIndex - 0.5;

          return (
            <Box key={starIndex} position="relative" w={`${size}px`} h={`${size}px`}>
              <Box
                as={Icon}
                boxSize={`${size}px`}
                color={hasActive ? activeColor : mutedColor}
                aria-hidden="true"
              />

              {!readOnly && onChange ? (
                <>
                  <Box
                    as="button"
                    type="button"
                    position="absolute"
                    top="0"
                    left="0"
                    w="50%"
                    h="100%"
                    aria-label={`${starIndex - 0.5} stars`}
                    onClick={() => onChange(starIndex - 0.5)}
                    bg="transparent"
                  />
                  <Box
                    as="button"
                    type="button"
                    position="absolute"
                    top="0"
                    left="50%"
                    w="50%"
                    h="100%"
                    aria-label={`${starIndex} stars`}
                    onClick={() => onChange(starIndex)}
                    bg="transparent"
                  />
                </>
              ) : null}
            </Box>
          );
        })}
      </Flex>

      {showValue ? (
        <Text fontSize="sm" color={mutedColor}>
          {normalizedValue.toFixed(1)} / 5
        </Text>
      ) : null}
    </Flex>
  );
}
