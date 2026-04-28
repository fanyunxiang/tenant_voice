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
  Input,
  Select,
  SimpleGrid,
  Skeleton,
  Text,
  useColorModeValue,
} from 'lib/chakra';
import { loadTenantListings, TenantListingItem, TenantListingsPagination } from 'lib/tenant/listingsClient';

const listingFilters = ['All', 'Apartment', 'House', 'Studio', 'Townhouse', 'Unit', 'Duplex'];

const FILTER_TO_PROPERTY_TYPE: Record<string, string> = {
  Apartment: 'APARTMENT',
  House: 'HOUSE',
  Studio: 'STUDIO',
  Townhouse: 'TOWNHOUSE',
  Unit: 'UNIT',
  Duplex: 'DUPLEX',
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

function parseOptionalNonNegativeInt(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export default function ListingsClient() {
  const { showNotice } = useGlobalNotice();
  const hasLoadedOnce = useRef(false);

  const [searchText, setSearchText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('0');
  const [activeFilter, setActiveFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [listings, setListings] = useState<TenantListingItem[]>([]);
  const [pagination, setPagination] = useState<TenantListingsPagination>(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const filterActiveBg = useColorModeValue('brand.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const tagBg = useColorModeValue('secondaryGray.200', 'whiteAlpha.200');

  const activePropertyTypeFilter = useMemo(
    () => FILTER_TO_PROPERTY_TYPE[activeFilter] ?? 'ALL',
    [activeFilter],
  );

  const refreshListings = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'initial' && !hasLoadedOnce.current) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const result = await loadTenantListings({
          q: searchText,
          location: locationText,
          propertyType: activePropertyTypeFilter,
          minPrice: parseOptionalNonNegativeInt(minPriceInput),
          maxPrice: parseOptionalNonNegativeInt(maxPriceInput),
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
    [activePropertyTypeFilter, locationText, maxPriceInput, minBedrooms, minPriceInput, page, pageSize, searchText, showNotice],
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
    setMinPriceInput('');
    setMaxPriceInput('');
    setMinBedrooms('0');
    setActiveFilter('All');
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
        <Flex gap="10px" wrap="wrap" mb="12px">
          {listingFilters.map((item) => (
            <Button
              key={item}
              size="sm"
              variant="ghost"
              bg={activeFilter === item ? filterActiveBg : 'transparent'}
              border="1px solid"
              borderColor={activeFilter === item ? 'transparent' : borderColor}
              onClick={() => {
                setActiveFilter(item);
                setPage(1);
              }}
            >
              {item}
            </Button>
          ))}
        </Flex>

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
              Min Weekly Rent
            </Text>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 500"
              value={minPriceInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setMinPriceInput(event.target.value);
                setPage(1);
              }}
            />
          </Box>

          <Box>
            <Text color={textSecondary} fontSize="xs" mb="4px">
              Max Weekly Rent
            </Text>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 900"
              value={maxPriceInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setMaxPriceInput(event.target.value);
                setPage(1);
              }}
            />
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

          <Box>
            <Text color={textSecondary} fontSize="xs" mb="4px">
              Page Size
            </Text>
            <Select
              value={String(pageSize)}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setPageSize(Number.parseInt(event.target.value, 10) || DEFAULT_PAGE_SIZE);
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </Select>
          </Box>
        </SimpleGrid>

        <Flex mt="12px" justify="flex-end">
          <Button size="sm" variant="outline" onClick={handleResetFilters}>
            Reset Filters
          </Button>
        </Flex>
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
        <Card p="16px" bg={panelBg}>
          <Text color={textPrimary} fontWeight="700" mb="6px">
            No matching listings
          </Text>
          <Text color={textSecondary} fontSize="sm">
            {loadError || 'Try broader filters, for example location "Wollongong" with no max price.'}
          </Text>
        </Card>
      ) : (
        <>
          <Flex mb="10px" align="center" justify="space-between" wrap="wrap" gap="8px">
            <Text color={textSecondary} fontSize="sm">
              {pagination.total} results
            </Text>
            <Text color={textSecondary} fontSize="sm">
              Page {pagination.totalPages === 0 ? 0 : pagination.page} / {pagination.totalPages}
            </Text>
          </Flex>

          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
            {listings.map((listing) => (
              <Card key={listing.id} p="14px" bg={panelBg} border="1px solid" borderColor={borderColor}>
              <Flex justify="space-between" align="center" mb="6px" gap="8px">
                  <Text
                    as={NextLink}
                    href={`/admin/listings/${listing.id}`}
                    color={textPrimary}
                    fontWeight="700"
                    fontSize="md"
                    noOfLines={1}
                    _hover={{ textDecoration: 'none', color: 'brand.500' }}
                  >
                    {listing.title}
                  </Text>
                  <Badge colorScheme="green">Published</Badge>
                </Flex>

                <Text color={textSecondary} fontSize="sm" mb="4px">
                  {listing.addressLine1}, {listing.suburb} {listing.state} {listing.postcode}
                </Text>
                <Text color={textSecondary} fontSize="sm" mb="10px">
                  Listed by {listing.landlordName}
                </Text>

                <Text color={textPrimary} fontSize="lg" fontWeight="700" mb="10px">
                  {formatWeeklyRent(listing.weeklyRent)}
                </Text>

                <Text color={textSecondary} fontSize="sm" mb="6px">
                  {formatBedrooms(listing.bedrooms)} bed • {formatBathrooms(listing.bathrooms)} bath •{' '}
                  {formatParking(listing.parkingSpaces)} parking
                </Text>

                <Flex gap="6px" wrap="wrap" mb="12px">
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

                <Button as={NextLink} href={`/admin/listings/${listing.id}`} size="sm">
                  View Details
                </Button>
              </Card>
            ))}
          </SimpleGrid>

          <Flex mt="16px" align="center" justify="space-between" wrap="wrap" gap="8px">
            <Text color={textSecondary} fontSize="sm">
              Showing {listings.length} of {pagination.total}
            </Text>
            <Flex gap="8px" align="center">
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination.hasPrev || isRefreshing}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination.hasNext || isRefreshing}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </Flex>
          </Flex>
        </>
      )}
    </Box>
  );
}
