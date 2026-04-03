import { Box, Skeleton, SkeletonText } from '@chakra-ui/react';

const LazyCardSkeleton = () => (
  <Box
    borderRadius="xl"
    p="24px"
    bg="white"
    boxShadow="sm"
    _dark={{ bg: 'navy.900', boxShadow: 'dark-lg' }}
    minH="240px"
    w="100%"
  >
    <Skeleton height="24px" mb="4" />
    <SkeletonText noOfLines={4} spacing="4" skeletonHeight="16px" />
  </Box>
);

export default LazyCardSkeleton;
