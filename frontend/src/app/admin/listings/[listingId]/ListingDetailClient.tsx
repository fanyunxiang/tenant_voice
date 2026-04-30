'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import Card from 'components/card/Card';
import StarRatingInput from 'components/rating/StarRatingInput';
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
  Textarea,
  useColorModeValue,
} from 'lib/chakra';
import {
  applyTenantListing,
  contactListingLandlord,
  createTenantMaintenanceRequest,
  loadTenantListingDetail,
  submitTenantListingReview,
  TenantListingDetailData,
} from 'lib/tenant/listingDetailClient';

const MAINTENANCE_CATEGORY_OPTIONS = [
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'APPLIANCE', label: 'Appliance' },
  { value: 'LOCKS_SECURITY', label: 'Locks / Security' },
  { value: 'GENERAL', label: 'General Repair' },
];

const MAINTENANCE_SEVERITY_OPTIONS: Array<{ value: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

function formatRent(value: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return `$${Math.round(value)}/week`;
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatPropertyType(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatListingStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type ListingDetailClientProps = {
  listingId: string;
};

export default function ListingDetailClient({ listingId }: ListingDetailClientProps) {
  const router = useRouter();
  const { showNotice } = useGlobalNotice();

  const [data, setData] = useState<TenantListingDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isContacting, setIsContacting] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [applicationMessage, setApplicationMessage] = useState('');
  const [reviewSortBy, setReviewSortBy] = useState<'LATEST' | 'BEST' | 'WORST'>('LATEST');

  const [reviewRating, setReviewRating] = useState(4.5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');

  const [maintenanceCategory, setMaintenanceCategory] = useState('PLUMBING');
  const [maintenanceSeverity, setMaintenanceSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const textReadable = useColorModeValue('secondaryGray.700', 'secondaryGray.300');
  const cardBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const subtleBg = useColorModeValue('secondaryGray.200', 'whiteAlpha.100');
  const detailPanelBg = useColorModeValue('white', 'navy.800');
  const detailItemBg = useColorModeValue('white', 'whiteAlpha.100');
  const detailItemBorder = useColorModeValue('#e9e3ff', 'whiteAlpha.200');
  const detailItemShadow = useColorModeValue('none', 'none');
  const detailLabelColor = useColorModeValue('#8E9EC5', 'secondaryGray.400');
  const landlordCardBg = useColorModeValue('white', 'navy.800');
  const landlordAvatarBg = useColorModeValue('brand.100', 'whiteAlpha.200');
  const landlordAvatarColor = useColorModeValue('brand.600', 'brand.300');
  const publishedBadgeBg = useColorModeValue('brand.100', 'whiteAlpha.200');
  const publishedBadgeColor = useColorModeValue('brand.500', 'brand.300');
  const signInHref = useMemo(
    () => `/auth/sign-in?next=${encodeURIComponent(`/admin/listings/${listingId}`)}`,
    [listingId],
  );

  const isTenantViewer = data?.viewerRole === 'TENANT';
  const hasApplied = Boolean(data?.rentalInsight.myApplication);
  const sortedPropertyReviews = useMemo(() => {
    if (!data) {
      return [];
    }

    const copied = [...data.reviews.property.recent];
    if (reviewSortBy === 'BEST') {
      copied.sort((a, b) => b.rating - a.rating);
      return copied;
    }

    if (reviewSortBy === 'WORST') {
      copied.sort((a, b) => a.rating - b.rating);
      return copied;
    }

    copied.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return copied;
  }, [data, reviewSortBy]);
  const groupedPropertyReviews = useMemo(() => {
    type ReviewItem = TenantListingDetailData['reviews']['property']['recent'][number];
    type GroupedReview = {
      key: string;
      review: ReviewItem;
      reply?: ReviewItem;
    };

    const grouped: GroupedReview[] = [];

    sortedPropertyReviews.forEach((item) => {
      const isLandlordReply = (item.title || '').toLowerCase() === 'landlord response';
      if (isLandlordReply && grouped.length > 0) {
        const latest = grouped[grouped.length - 1];
        if (!latest.reply) {
          latest.reply = item;
          return;
        }
      }

      grouped.push({ key: item.id, review: item });
    });

    return grouped;
  }, [sortedPropertyReviews]);

  const refreshDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await loadTenantListingDetail(listingId);
      if (!result.ok || !result.data) {
        throw new Error(result.message || 'Failed to load listing details.');
      }

      setData(result.data);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load listing details.';
      setLoadError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void refreshDetail();
  }, [refreshDetail]);

  useEffect(() => {
    if (!data?.actions.myReview) {
      return;
    }

    setReviewRating(data.actions.myReview.rating);
    setReviewTitle(data.actions.myReview.title ?? '');
    setReviewBody(data.actions.myReview.body ?? '');
  }, [data?.actions.myReview]);

  useEffect(() => {
    if (isLoading || data) {
      return;
    }

    const requiresAuth = (loadError || '').toLowerCase().includes('not authenticated');
    if (requiresAuth) {
      router.replace(signInHref);
    }
  }, [data, isLoading, loadError, router, signInHref]);

  const handleApply = useCallback(async () => {
    if (!isTenantViewer || !data) {
      return;
    }

    setIsApplying(true);
    try {
      const result = await applyTenantListing({
        listingId: data.listing.id,
        message: applicationMessage,
      });

      if (!result.ok || !result.data) {
        throw new Error(result.message || 'Failed to submit application.');
      }

      showNotice({
        type: 'success',
        message: result.message || `Application status: ${result.data.status}`,
      });

      setApplicationMessage('');
      await refreshDetail();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit application.';
      showNotice({ type: 'error', message });
    } finally {
      setIsApplying(false);
    }
  }, [applicationMessage, data, isTenantViewer, refreshDetail, showNotice]);

  const handleContact = useCallback(async () => {
    if (!data) {
      return;
    }

    setIsContacting(true);
    try {
      const result = await contactListingLandlord({
        listingId: data.listing.id,
        content: `Hi, I am interested in ${data.listing.title}. Is inspection available this week?`,
      });

      if (!result.ok || !result.data) {
        throw new Error(result.message || 'Failed to contact landlord.');
      }

      showNotice({
        type: 'success',
        message: result.message || 'Conversation ready.',
      });

      router.push('/admin/messages');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to contact landlord.';
      showNotice({ type: 'error', message });
    } finally {
      setIsContacting(false);
    }
  }, [data, router, showNotice]);

  const handleSubmitReview = useCallback(async () => {
    if (!data) {
      return;
    }

    setIsSubmittingReview(true);
    try {
      const result = await submitTenantListingReview({
        listingId: data.listing.id,
        rating: reviewRating,
        title: reviewTitle,
        body: reviewBody,
      });

      if (!result.ok || !result.data) {
        throw new Error(result.message || 'Failed to submit review.');
      }

      showNotice({ type: 'success', message: result.message || 'Review submitted.' });
      await refreshDetail();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit review.';
      showNotice({ type: 'error', message });
    } finally {
      setIsSubmittingReview(false);
    }
  }, [data, refreshDetail, reviewBody, reviewRating, reviewTitle, showNotice]);

  const handleSubmitMaintenance = useCallback(async () => {
    if (!data) {
      return;
    }

    setIsSubmittingMaintenance(true);
    try {
      const result = await createTenantMaintenanceRequest({
        listingId: data.listing.id,
        category: maintenanceCategory,
        severity: maintenanceSeverity,
        description: maintenanceDescription,
      });

      if (!result.ok || !result.data) {
        throw new Error(result.message || 'Failed to submit maintenance request.');
      }

      showNotice({ type: 'success', message: result.message || 'Maintenance request submitted.' });
      setMaintenanceDescription('');
      await refreshDetail();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit maintenance request.';
      showNotice({ type: 'error', message });
    } finally {
      setIsSubmittingMaintenance(false);
    }
  }, [data, maintenanceCategory, maintenanceDescription, maintenanceSeverity, refreshDetail, showNotice]);

  if (isLoading) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Card p="16px" bg={cardBg}>
          <Skeleton h="28px" mb="10px" />
          <Skeleton h="16px" mb="6px" />
          <Skeleton h="16px" />
        </Card>
      </Box>
    );
  }

  if (!data) {
    const requiresAuth = (loadError || '').toLowerCase().includes('not authenticated');
    if (requiresAuth) {
      return (
        <Box pt={{ base: '8px', md: '12px' }}>
          <Card p="16px" bg={cardBg}>
            <Text color={textSecondary} fontSize="sm">
              Redirecting to sign in...
            </Text>
          </Card>
        </Box>
      );
    }

    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="6px">
            Listing unavailable
          </Text>
          <Text color={textSecondary} fontSize="sm" mb="12px">
            {loadError || 'This listing may have been removed or is not currently visible.'}
          </Text>
          <Flex gap="8px" wrap="wrap">
            <Button as={NextLink} href="/admin/listings" size="sm">
              Back to Listings
            </Button>
          </Flex>
        </Card>
      </Box>
    );
  }

  const { listing, property, landlord, rentalInsight, reviews, actions } = data;

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Flex justify="space-between" align="center" mb="14px" wrap="wrap" gap="8px">
        <Box>
          <Text fontSize="2xl" color={textPrimary} fontWeight="700">
            {listing.title}
          </Text>
          <Text color={textSecondary}>
            {property.addressLine1}, {property.suburb} {property.state} {property.postcode}
          </Text>
        </Box>
        <Button as={NextLink} href="/admin/listings" size="sm" variant="outline">
          Back
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="16px" mb="16px">
        <Card
          p={{ base: '16px', md: '18px' }}
          bg={detailPanelBg}
          border="1px solid"
          borderColor={borderColor}
          boxShadow={detailItemShadow}
          gridColumn={{ base: 'span 1', xl: 'span 2' }}
        >
          <Flex justify="space-between" align="center" mb="8px" gap="8px" wrap="wrap">
            <Text color={textPrimary} fontWeight="700" fontSize="lg">
              Property Details
            </Text>
            <Badge
              bg={publishedBadgeBg}
              color={publishedBadgeColor}
              borderRadius="8px"
              px="10px"
              py="6px"
              fontWeight="600"
            >
              {formatListingStatus(listing.status)}
            </Badge>
          </Flex>

          <Text color={textSecondary} mb="10px">
            {listing.description || 'No additional description provided.'}
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="12px">
            <Box bg={detailItemBg} p="12px" borderRadius="12px" border="1px solid" borderColor={detailItemBorder}>
              <Text color={detailLabelColor} fontSize="xs">
                Weekly Rent
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {formatRent(listing.weeklyRent)}
              </Text>
            </Box>
            <Box bg={detailItemBg} p="12px" borderRadius="12px" border="1px solid" borderColor={detailItemBorder}>
              <Text color={detailLabelColor} fontSize="xs">
                Bond
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {listing.bondAmount ? `$${Math.round(listing.bondAmount)}` : '-'}
              </Text>
            </Box>
            <Box bg={detailItemBg} p="12px" borderRadius="12px" border="1px solid" borderColor={detailItemBorder}>
              <Text color={detailLabelColor} fontSize="xs">
                Available From
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {formatDate(listing.availableFrom)}
              </Text>
            </Box>
            <Box bg={detailItemBg} p="12px" borderRadius="12px" border="1px solid" borderColor={detailItemBorder}>
              <Text color={detailLabelColor} fontSize="xs">
                Lease Term
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {listing.leaseTermMonths ? `${listing.leaseTermMonths} months` : 'Flexible'}
              </Text>
            </Box>
            <Box bg={detailItemBg} p="12px" borderRadius="12px" border="1px solid" borderColor={detailItemBorder}>
              <Text color={detailLabelColor} fontSize="xs">
                Layout
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {property.bedrooms ?? '-'} bed • {property.bathrooms ?? '-'} bath • {property.parkingSpaces ?? '-'} parking
              </Text>
            </Box>
            <Box bg={detailItemBg} p="12px" borderRadius="12px" border="1px solid" borderColor={detailItemBorder}>
              <Text color={detailLabelColor} fontSize="xs">
                Type
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {formatPropertyType(property.propertyType)} {property.petFriendly ? '• Pet Friendly' : '• No Pets'}
              </Text>
            </Box>
          </SimpleGrid>
        </Card>

        <Card
          p={{ base: '16px', md: '18px' }}
          bg={landlordCardBg}
          border="1px solid"
          borderColor={detailItemBorder}
          display="flex"
          flexDirection="column"
          minH={{ base: 'auto', xl: '100%' }}
        >
          <Text color={textPrimary} fontWeight="700" mb="8px">
            Landlord
          </Text>
          <Flex align="center" gap="10px" mb="12px">
            <Flex
              w="42px"
              h="42px"
              borderRadius="full"
              align="center"
              justify="center"
              bg={landlordAvatarBg}
              color={landlordAvatarColor}
              fontWeight="700"
            >
              {landlord.name.slice(0, 1).toUpperCase()}
            </Flex>
            <Box>
              <Text color={textPrimary} fontWeight="700" lineHeight="1.2">
                {landlord.name}
              </Text>
              <Text color={textReadable} fontSize="sm">
                {landlord.email}
              </Text>
            </Box>
          </Flex>

          <Flex mt="auto" pt={{ base: '16px', xl: '32px' }} gap="8px" wrap="wrap">
            <Button loading={isContacting} onClick={handleContact} flex={{ base: '1 1 100%', md: '1 1 auto' }}>
              Send Message
            </Button>
            <Button
              variant="outline"
              as={NextLink}
              href="/admin/messages"
              flex={{ base: '1 1 100%', md: '1 1 auto' }}
            >
              Open Messages
            </Button>
          </Flex>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="16px" mb="16px" alignItems="stretch">
        <Card
          p={{ base: '16px', md: '18px' }}
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
          display="flex"
          flexDirection="column"
          h="100%"
        >
          <Text color={textPrimary} fontWeight="700" mb="10px">
            Rental Situation
          </Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="10px" flex="1">
            <Box
              border="1px solid"
              borderColor={borderColor}
              borderRadius="12px"
              p="12px"
              bg={subtleBg}
              minH="108px"
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
            >
              <Text fontSize="xs" color={textSecondary} fontWeight="600">
                Total Applications
              </Text>
              <Text fontWeight="700" color={textPrimary} fontSize="3xl" lineHeight="1.1">
                {rentalInsight.totalApplications}
              </Text>
            </Box>
            <Box
              border="1px solid"
              borderColor={borderColor}
              borderRadius="12px"
              p="12px"
              bg={subtleBg}
              minH="108px"
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
            >
              <Text fontSize="xs" color={textSecondary} fontWeight="600">
                Listing Status
              </Text>
              <Badge
                alignSelf="flex-start"
                bg={publishedBadgeBg}
                color={publishedBadgeColor}
                borderRadius="8px"
                px="10px"
                py="6px"
                fontWeight="700"
                fontSize="sm"
                textTransform="none"
              >
                {formatListingStatus(rentalInsight.listingStatus)}
              </Badge>
            </Box>
            <Box
              border="1px solid"
              borderColor={borderColor}
              borderRadius="12px"
              p="12px"
              bg={subtleBg}
              minH="108px"
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
            >
              <Text fontSize="xs" color={textSecondary} fontWeight="600">
                Repairs
              </Text>
              <Text fontWeight="700" color={textPrimary} fontSize="3xl" lineHeight="1.1">
                {actions.myOpenMaintenanceCount}
              </Text>
            </Box>
          </SimpleGrid>
        </Card>

        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="10px">
            Apply for This Property
          </Text>
          {!isTenantViewer ? (
            <Text color={textSecondary} fontSize="sm">
              Only tenant accounts can submit rental applications.
            </Text>
          ) : (
            <>
              {hasApplied ? (
                <Text color={textSecondary} fontSize="sm" mb="10px">
                  You already have an application on this listing. You can submit again if previous status allows it.
                </Text>
              ) : null}
              <Textarea
                placeholder="Application note for landlord (optional)"
                minH="110px"
                value={applicationMessage}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setApplicationMessage(event.target.value)}
                mb="10px"
              />
              <Button loading={isApplying} onClick={handleApply}>
                Submit Application
              </Button>
            </>
          )}
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1 }} gap="16px" mb="16px">
        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="10px">
            Reviews
          </Text>
          <Flex justify="space-between" align="center" wrap="wrap" gap="8px" mb="10px">
            <Text color={textReadable} fontSize="sm" fontWeight="600">
              Average: {reviews.property.averageRating ?? '-'} ({reviews.property.totalCount} reviews)
            </Text>
            <Select
              w={{ base: '100%', md: '180px' }}
              value={reviewSortBy}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setReviewSortBy(event.target.value as 'LATEST' | 'BEST' | 'WORST')
              }
            >
              <option value="LATEST">Latest</option>
              <option value="BEST">Highest Rating</option>
              <option value="WORST">Lowest Rating</option>
            </Select>
          </Flex>
          {groupedPropertyReviews.length === 0 ? (
            <Text color={textReadable} fontSize="sm">
              No public property reviews yet.
            </Text>
          ) : (
            <Flex direction="column" gap="10px">
              {groupedPropertyReviews.map((item) => (
                <Box key={item.key} border="1px solid" borderColor={borderColor} borderRadius="10px" p="10px">
                  <Flex justify="space-between" align="center" mb="4px" gap="8px">
                    <Text color={textPrimary} fontWeight="700" fontSize="sm">
                      {item.review.reviewerName}
                    </Text>
                    <StarRatingInput value={item.review.rating} readOnly size={14} showValue={false} />
                  </Flex>
                  {item.review.title && !/^tenant review \d+-\d+$/i.test(item.review.title) ? (
                    <Text color={textPrimary} fontSize="sm" fontWeight="600">
                      {item.review.title}
                    </Text>
                  ) : null}
                  <Text color={textReadable} fontSize="sm" mb="4px">
                    {item.review.body || '-'}
                  </Text>
                  <Text color={textReadable} fontSize="xs">
                    {formatDate(item.review.createdAt)} {item.review.isVerifiedInteraction ? '• Verified' : ''}
                  </Text>
                  {item.reply ? (
                    <Box mt="8px" pl="10px" borderLeft="2px solid" borderColor={borderColor}>
                      <Text color={textPrimary} fontSize="xs" fontWeight="700" mb="2px">
                        Landlord reply
                      </Text>
                      <Text color={textReadable} fontSize="sm" mb="2px">
                        {item.reply.body || '-'}
                      </Text>
                      <Text color={textReadable} fontSize="xs">
                        {formatDate(item.reply.createdAt)}
                      </Text>
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Flex>
          )}
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="16px">
        {actions.canReview ? (
          <Card p="16px" bg={cardBg}>
            <Text color={textPrimary} fontWeight="700" mb="10px">
              Rate This Property
            </Text>
            <>
              <StarRatingInput value={reviewRating} onChange={setReviewRating} />
              <Input
                mt="10px"
                placeholder="Review title (optional)"
                value={reviewTitle}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setReviewTitle(event.target.value)}
              />
              <Textarea
                mt="8px"
                placeholder="Share your rental experience"
                minH="120px"
                value={reviewBody}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReviewBody(event.target.value)}
              />
              {actions.myReview ? (
                <Text mt="8px" fontSize="xs" color={textSecondary}>
                  Last updated: {formatDate(actions.myReview.updatedAt)}
                </Text>
              ) : null}
              <Button mt="10px" loading={isSubmittingReview} onClick={handleSubmitReview}>
                {actions.myReview ? 'Update Review' : 'Submit Review'}
              </Button>
            </>
          </Card>
        ) : null}

        {actions.canRequestMaintenance ? (
          <Card p="16px" bg={cardBg}>
            <Text color={textPrimary} fontWeight="700" mb="10px">
              Maintenance Request
            </Text>
            <>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="8px" mb="8px">
                <Box>
                  <Text fontSize="xs" color={textSecondary} mb="4px">
                    Issue Type
                  </Text>
                  <Select
                    value={maintenanceCategory}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => setMaintenanceCategory(event.target.value)}
                  >
                    {MAINTENANCE_CATEGORY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Box>

                <Box>
                  <Text fontSize="xs" color={textSecondary} mb="4px">
                    Severity
                  </Text>
                  <Select
                    value={maintenanceSeverity}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setMaintenanceSeverity(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
                    }
                  >
                    {MAINTENANCE_SEVERITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Box>
              </SimpleGrid>

              <Textarea
                placeholder="Describe the issue, location, urgency, and any safety concern"
                minH="120px"
                value={maintenanceDescription}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMaintenanceDescription(event.target.value)}
              />
              <Button mt="10px" loading={isSubmittingMaintenance} onClick={handleSubmitMaintenance}>
                Submit Maintenance Request
              </Button>
            </>
          </Card>
        ) : null}
      </SimpleGrid>

      <Card p="16px" bg={cardBg} mt="16px">
        <Text color={textPrimary} fontWeight="700" mb="10px">
          Maintenance History
        </Text>
        <Text color={textSecondary} fontSize="sm" mb="10px">
          Open: {data.maintenance.openCount} · Resolved: {data.maintenance.resolvedCount}
        </Text>
        {data.maintenance.recent.length === 0 ? (
          <Text color={textSecondary} fontSize="sm">
            No maintenance records on this property yet.
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="10px">
            {data.maintenance.recent.map((item) => (
              <Box key={item.id} border="1px solid" borderColor={borderColor} borderRadius="10px" p="10px">
                <Flex justify="space-between" align="center" mb="4px" gap="8px" wrap="wrap">
                  <Text color={textPrimary} fontWeight="700" fontSize="sm">
                    {item.category}
                  </Text>
                  <Badge colorScheme={item.status === 'RESOLVED' || item.status === 'CLOSED' ? 'green' : 'orange'}>
                    {formatListingStatus(item.status)}
                  </Badge>
                </Flex>
                <Text color={textSecondary} fontSize="sm" mb="4px">
                  {item.note}
                </Text>
                <Text color={textSecondary} fontSize="xs">
                  {item.reporterName} · {formatListingStatus(item.severity)} · Lodged {formatDate(item.lodgedAt)}
                  {item.assignedWorker ? ` · Worker: ${item.assignedWorker}` : ''}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Card>
    </Box>
  );
}
