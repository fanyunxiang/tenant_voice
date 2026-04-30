'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NextLink from 'next/link';
import Card from 'components/card/Card';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';
import {
  Badge,
  Box,
  Button,
  Flex,
  Image,
  Input,
  Select,
  SimpleGrid,
  Skeleton,
  Text,
  useColorModeValue,
} from 'lib/chakra';
import { loadTenantListings, TenantListingItem, TenantListingsPagination } from 'lib/tenant/listingsClient';

const PROPERTY_TYPE_OPTIONS = [
  { label: 'All property types', value: 'ALL' },
  { label: 'Apartment', value: 'APARTMENT' },
  { label: 'House', value: 'HOUSE' },
  { label: 'Studio', value: 'STUDIO' },
  { label: 'Townhouse', value: 'TOWNHOUSE' },
  { label: 'Unit', value: 'UNIT' },
  { label: 'Duplex', value: 'DUPLEX' },
];

const WEEKLY_RENT_RANGE_OPTIONS = [
  { label: 'Any weekly rent', value: 'ANY' },
  { label: 'Under $500 / week', value: 'UNDER_500' },
  { label: '$500 - $699 / week', value: '500_699' },
  { label: '$700 - $899 / week', value: '700_899' },
  { label: '$900 - $1,099 / week', value: '900_1099' },
  { label: '$1,100+ / week', value: '1100_PLUS' },
];

const RENT_RANGE_TO_BOUNDS: Record<string, { minPrice?: number; maxPrice?: number }> = {
  ANY: {},
  UNDER_500: { maxPrice: 499 },
  '500_699': { minPrice: 500, maxPrice: 699 },
  '700_899': { minPrice: 700, maxPrice: 899 },
  '900_1099': { minPrice: 900, maxPrice: 1099 },
  '1100_PLUS': { minPrice: 1100 },
};

const DEFAULT_PAGE_SIZE = 9;
const PAGE_SIZE_OPTIONS = [6, 9, 12, 24];
const DEFAULT_PAGINATION: TenantListingsPagination = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasPrev: false,
  hasNext: false,
};

function formatWeeklyRent(value: number) {
  return `$${Math.round(value)}/week`;
}

function formatBedrooms(value: number | null) {
  return typeof value === 'number' ? value : '-';
}

function formatBathrooms(value: number | null) {
  return typeof value === 'number' ? value : '-';
}

function formatParking(value: number | null) {
  return typeof value === 'number' ? value : '-';
}

function formatPropertyType(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildPageItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  pages.add(currentPage);
  pages.add(Math.max(1, currentPage - 1));
  pages.add(Math.min(totalPages, currentPage + 1));

  const sorted = Array.from(pages)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | 'ellipsis'> = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index];
    const prev = sorted[index - 1];
    if (index > 0 && prev !== undefined && page - prev > 1) {
      items.push('ellipsis');
    }
    items.push(page);
  }

  return items;
}

export default function ListingsClient() {
  const { showNotice } = useGlobalNotice();
  const hasLoadedOnce = useRef(false);

  const [searchText, setSearchText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [weeklyRentRange, setWeeklyRentRange] = useState('ANY');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('ALL');
  const [minBedrooms, setMinBedrooms] = useState('0');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [jumpPageInput, setJumpPageInput] = useState('');

  const [listings, setListings] = useState<TenantListingItem[]>([]);
  const [pagination, setPagination] = useState<TenantListingsPagination>(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const tagBg = useColorModeValue('secondaryGray.200', 'whiteAlpha.200');
  const imagePlaceholderBg = useColorModeValue('secondaryGray.100', 'navy.700');
  const pageItems = useMemo(
    () => buildPageItems(pagination.page || page, pagination.totalPages),
    [page, pagination.page, pagination.totalPages],
  );

  const refreshListings = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      const rentBounds = RENT_RANGE_TO_BOUNDS[weeklyRentRange] ?? {};

      if (mode === 'initial' && !hasLoadedOnce.current) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const result = await loadTenantListings({
          q: searchText,
          location: locationText,
          propertyType: propertyTypeFilter,
          minPrice: rentBounds.minPrice,
          maxPrice: rentBounds.maxPrice,
          minBedrooms: Number.parseInt(minBedrooms, 10) > 0 ? Number.parseInt(minBedrooms, 10) : undefined,
          page,
          pageSize,
        });

        if (!result.ok || !result.data) {
          throw new Error(result.message || 'Failed to load listings.');
        }

        setListings(result.data.listings);
        setPagination(result.data.pagination);
        setLoadError(null);

        if (result.data.pagination.page !== page) {
          setPage(result.data.pagination.page);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load listings.';
        setLoadError(message);
        setListings([]);
        setPagination({ ...DEFAULT_PAGINATION, pageSize });

        if (mode === 'refresh') {
          showNotice({ type: 'error', message });
        }
      } finally {
        hasLoadedOnce.current = true;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [locationText, minBedrooms, page, pageSize, propertyTypeFilter, searchText, showNotice, weeklyRentRange],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshListings('initial');
    }, 280);

    return () => {
      clearTimeout(timer);
    };
  }, [refreshListings]);

  const handleResetFilters = useCallback(() => {
    setSearchText('');
    setLocationText('');
    setWeeklyRentRange('ANY');
    setPropertyTypeFilter('ALL');
    setMinBedrooms('0');
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
  }, []);

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Flex mb="16px" align="center" justify="space-between" wrap="wrap" gap="8px">
        <Box>
          <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
            Listings
          </Text>
          <Text fontSize="sm" color={textSecondary}>
            Search and filter by location, weekly rent, property type, and room count.
          </Text>
        </Box>
        <Button size="sm" loading={isRefreshing} onClick={() => void refreshListings('refresh')}>
          Refresh
        </Button>
      </Flex>

      <Card p="14px" mb="16px" bg={panelBg}>
        <Flex align="center" justify="space-between" mb={filtersExpanded ? '12px' : '0'}>
          <Text color={textPrimary} fontSize="md" fontWeight="700">
            Filters
          </Text>
          <Button size="sm" variant="outline" onClick={() => setFiltersExpanded((current) => !current)}>
            {filtersExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </Flex>

        {filtersExpanded ? (
          <>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="10px">
              <Box>
                <Text color={textSecondary} fontSize="xs" mb="4px">
                  Keyword
                </Text>
                <Input
                  placeholder="Title, address, landlord..."
                  value={searchText}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setSearchText(event.target.value);
                    setPage(1);
                  }}
                />
              </Box>

              <Box>
                <Text color={textSecondary} fontSize="xs" mb="4px">
                  Location
                </Text>
                <Input
                  placeholder="Suburb / state / postcode"
                  value={locationText}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setLocationText(event.target.value);
                    setPage(1);
                  }}
                />
              </Box>

              <Box>
                <Text color={textSecondary} fontSize="xs" mb="4px">
                  Weekly Rent
                </Text>
                <Select
                  value={weeklyRentRange}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setWeeklyRentRange(event.target.value);
                    setPage(1);
                  }}
                >
                  {WEEKLY_RENT_RANGE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Text color={textSecondary} fontSize="xs" mb="4px">
                  Property Type
                </Text>
                <Select
                  value={propertyTypeFilter}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setPropertyTypeFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  {PROPERTY_TYPE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Text color={textSecondary} fontSize="xs" mb="4px">
                  Bedrooms
                </Text>
                <Select
                  value={minBedrooms}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    setMinBedrooms(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="0">Any</option>
                  <option value="1">1+ bedrooms</option>
                  <option value="2">2+ bedrooms</option>
                  <option value="3">3+ bedrooms</option>
                  <option value="4">4+ bedrooms</option>
                </Select>
              </Box>
            </SimpleGrid>

            <Flex mt="12px" justify="flex-end" gap="8px">
              <Button size="sm" onClick={() => void refreshListings('refresh')} loading={isRefreshing}>
                Search
              </Button>
              <Button size="sm" variant="outline" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            </Flex>
          </>
        ) : null}
      </Card>

      {isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
          <Card p="14px" bg={panelBg}>
            <Skeleton h="120px" borderRadius="12px" />
          </Card>
          <Card p="14px" bg={panelBg}>
            <Skeleton h="120px" borderRadius="12px" />
          </Card>
          <Card p="14px" bg={panelBg}>
            <Skeleton h="120px" borderRadius="12px" />
          </Card>
        </SimpleGrid>
      ) : listings.length === 0 ? (
        <>
          <Card p="16px" bg={panelBg}>
            <Text color={textPrimary} fontWeight="700" mb="6px">
              No matching listings
            </Text>
            <Text color={textSecondary} fontSize="sm">
              {loadError || 'Try broader filters, for example location "Wollongong" with no max price.'}
            </Text>
          </Card>
          <Flex mt="16px" align="center" justify="flex-end">
            <Flex align="center" gap="8px" wrap="wrap">
              <Text color={textSecondary} fontSize="sm">
                Page Size
              </Text>
              <Select
                w="128px"
                value={String(pageSize)}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  setPageSize(Number.parseInt(event.target.value, 10) || DEFAULT_PAGE_SIZE);
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </Select>
            </Flex>
          </Flex>
        </>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
            {listings.map((listing) => (
              <Card
                key={listing.id}
                p="0"
                bg={panelBg}
                border="1px solid"
                borderColor={borderColor}
                h="100%"
                overflow="hidden"
                display="flex"
                flexDirection="column"
              >
                <Box
                  as={NextLink}
                  href={`/admin/listings/${listing.id}`}
                  h="180px"
                  bg={imagePlaceholderBg}
                  display="block"
                >
                  {listing.coverImageUrl ? (
                    <Image src={listing.coverImageUrl} alt={listing.title} w="100%" h="100%" objectFit="cover" />
                  ) : (
                    <Flex h="100%" align="center" justify="center">
                      <Text color={textSecondary} fontSize="sm" fontWeight="600">
                        Property photos coming soon
                      </Text>
                    </Flex>
                  )}
                </Box>

                <Flex p="14px" direction="column" flex="1" gap="0">
                  <Flex justify="space-between" align="flex-start" mb="8px" gap="8px">
                  <Text
                    as={NextLink}
                    href={`/admin/listings/${listing.id}`}
                    color={textPrimary}
                    fontWeight="700"
                    fontSize="md"
                    lineHeight="1.35"
                    minH="44px"
                    overflow="hidden"
                    display="-webkit-box"
                    sx={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                    _hover={{ textDecoration: 'none', color: 'brand.500' }}
                  >
                    {listing.title}
                  </Text>
                  <Badge
                    bg="green.500"
                    color="white"
                    borderRadius="999px"
                    px="12px"
                    py="6px"
                    fontSize="12px"
                    fontWeight="700"
                    letterSpacing="0.01em"
                    textTransform="none"
                    boxShadow="0 8px 18px rgba(34, 197, 94, 0.24)"
                  >
                    Published
                  </Badge>
                </Flex>

                  <Text
                    color={textSecondary}
                    fontSize="sm"
                    mb="4px"
                    minH="42px"
                    overflow="hidden"
                    display="-webkit-box"
                    sx={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                  >
                    {listing.addressLine1}, {listing.suburb} {listing.state} {listing.postcode}
                  </Text>
                  <Text color={textSecondary} fontSize="sm" mb="10px" noOfLines={1} minH="20px">
                    Listed by {listing.landlordName}
                  </Text>

                  <Text color={textPrimary} fontSize="lg" fontWeight="700" mb="10px">
                    {formatWeeklyRent(listing.weeklyRent)}
                  </Text>

                  <Text color={textSecondary} fontSize="sm" mb="6px">
                    {formatBedrooms(listing.bedrooms)} bed • {formatBathrooms(listing.bathrooms)} bath •{' '}
                    {formatParking(listing.parkingSpaces)} parking
                  </Text>

                  <Flex gap="6px" wrap="wrap" minH="28px">
                    <Badge bg={tagBg} color={textPrimary}>
                      {formatPropertyType(listing.propertyType)}
                    </Badge>
                    {listing.petFriendly ? (
                      <Badge colorScheme="purple">Pet Friendly</Badge>
                    ) : (
                      <Badge bg={tagBg} color={textPrimary}>
                        No Pets
                      </Badge>
                    )}
                  </Flex>

                  <Box mt="auto" pt="12px">
                    <Button as={NextLink} href={`/admin/listings/${listing.id}`} size="sm" w="100%">
                      View Details
                    </Button>
                  </Box>
                </Flex>
              </Card>
            ))}
          </SimpleGrid>

          <Flex mt="16px" align="center" justify="space-between" wrap="wrap" gap="8px">
            <Text color={textSecondary} fontSize="sm">
              {pagination.total} results · Page {pagination.totalPages === 0 ? 0 : pagination.page} /{' '}
              {pagination.totalPages} · Showing {listings.length} of {pagination.total}
            </Text>
            <Flex align="center" gap="8px" wrap="wrap">
              <Text color={textSecondary} fontSize="sm">
                Page Size
              </Text>
              <Select
                w="128px"
                value={String(pageSize)}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  setPageSize(Number.parseInt(event.target.value, 10) || DEFAULT_PAGE_SIZE);
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </Select>
            </Flex>
          </Flex>

          <Flex mt="10px" align="center" justify="space-between" wrap="wrap" gap="8px">
            <Flex gap="8px" align="center" wrap="wrap">
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination.hasPrev || isRefreshing}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              {pageItems.map((item, index) =>
                item === 'ellipsis' ? (
                  <Text key={`ellipsis-${index}`} color={textSecondary} px="2">
                    ...
                  </Text>
                ) : (
                  <Button
                    key={item}
                    size="sm"
                    variant={item === pagination.page ? 'solid' : 'outline'}
                    disabled={isRefreshing}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </Button>
                ),
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination.hasNext || isRefreshing}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </Flex>
            <Flex align="center" gap="8px">
              <Text color={textSecondary} fontSize="sm">
                Jump
              </Text>
              <Input
                w="84px"
                type="number"
                min={1}
                max={Math.max(1, pagination.totalPages)}
                value={jumpPageInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setJumpPageInput(event.target.value)}
                placeholder="page"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={isRefreshing || pagination.totalPages < 1}
                onClick={() => {
                  const parsed = Number.parseInt(jumpPageInput, 10);
                  if (!Number.isFinite(parsed)) {
                    return;
                  }
                  const nextPage = Math.min(Math.max(parsed, 1), Math.max(1, pagination.totalPages));
                  setPage(nextPage);
                }}
              >
                Go
              </Button>
            </Flex>
          </Flex>
        </>
      )}
    </Box>
  );
}
