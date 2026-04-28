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
  const [offerWeeklyRentInput, setOfferWeeklyRentInput] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  const [reviewRating, setReviewRating] = useState(4.5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');

  const [maintenanceCategory, setMaintenanceCategory] = useState('PLUMBING');
  const [maintenanceSeverity, setMaintenanceSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const cardBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const subtleBg = useColorModeValue('secondaryGray.200', 'whiteAlpha.100');

  const isTenantViewer = data?.viewerRole === 'TENANT';
  const hasApplied = Boolean(data?.rentalInsight.myApplication);

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

  const offerWeeklyRent = useMemo(() => {
    const parsed = Number(offerWeeklyRentInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [offerWeeklyRentInput]);

  const handleApply = useCallback(async () => {
    if (!isTenantViewer || !data) {
      return;
    }

    setIsApplying(true);
    try {
      const result = await applyTenantListing({
        listingId: data.listing.id,
        message: applicationMessage,
        offerWeeklyRent,
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
  }, [applicationMessage, data, isTenantViewer, offerWeeklyRent, refreshDetail, showNotice]);

  const handleContact = useCallback(async () => {
    if (!data) {
      return;
    }

    setIsContacting(true);
    try {
      const result = await contactListingLandlord({
        listingId: data.listing.id,
        content: contactMessage,
      });

      if (!result.ok || !result.data) {
        throw new Error(result.message || 'Failed to contact landlord.');
      }

      showNotice({
        type: 'success',
        message: result.message || 'Conversation ready.',
      });

      setContactMessage('');
      router.push('/admin/messages');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to contact landlord.';
      showNotice({ type: 'error', message });
    } finally {
      setIsContacting(false);
    }
  }, [contactMessage, data, router, showNotice]);

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
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="6px">
            Listing unavailable
          </Text>
          <Text color={textSecondary} fontSize="sm" mb="12px">
            {loadError || 'This listing may have been removed or is not currently visible.'}
          </Text>
          <Button as={NextLink} href="/admin/listings" size="sm">
            Back to Listings
          </Button>
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
        <Card p="16px" bg={cardBg} gridColumn={{ base: 'span 1', xl: 'span 2' }}>
          <Flex justify="space-between" align="center" mb="8px" gap="8px" wrap="wrap">
            <Text color={textPrimary} fontWeight="700" fontSize="lg">
              Property Details
            </Text>
            <Badge colorScheme={listing.status === 'PUBLISHED' ? 'green' : 'orange'}>
              {formatListingStatus(listing.status)}
            </Badge>
          </Flex>

          <Text color={textSecondary} mb="10px">
            {listing.description || 'No additional description provided.'}
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="10px">
            <Box bg={subtleBg} p="10px" borderRadius="10px">
              <Text color={textSecondary} fontSize="xs">
                Weekly Rent
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {formatRent(listing.weeklyRent)}
              </Text>
            </Box>
            <Box bg={subtleBg} p="10px" borderRadius="10px">
              <Text color={textSecondary} fontSize="xs">
                Bond
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {listing.bondAmount ? `$${Math.round(listing.bondAmount)}` : '-'}
              </Text>
            </Box>
            <Box bg={subtleBg} p="10px" borderRadius="10px">
              <Text color={textSecondary} fontSize="xs">
                Available From
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {formatDate(listing.availableFrom)}
              </Text>
            </Box>
            <Box bg={subtleBg} p="10px" borderRadius="10px">
              <Text color={textSecondary} fontSize="xs">
                Lease Term
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {listing.leaseTermMonths ? `${listing.leaseTermMonths} months` : 'Flexible'}
              </Text>
            </Box>
            <Box bg={subtleBg} p="10px" borderRadius="10px">
              <Text color={textSecondary} fontSize="xs">
                Layout
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {property.bedrooms ?? '-'} bed • {property.bathrooms ?? '-'} bath • {property.parkingSpaces ?? '-'} parking
              </Text>
            </Box>
            <Box bg={subtleBg} p="10px" borderRadius="10px">
              <Text color={textSecondary} fontSize="xs">
                Type
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {formatPropertyType(property.propertyType)} {property.petFriendly ? '• Pet Friendly' : '• No Pets'}
              </Text>
            </Box>
          </SimpleGrid>
        </Card>

        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="8px">
            Landlord
          </Text>
          <Text color={textPrimary} fontWeight="600">
            {landlord.name}
          </Text>
          <Text color={textSecondary} fontSize="sm" mb="10px">
            {landlord.email}
          </Text>
          <Text color={textSecondary} fontSize="sm">
            Landlord rating: {reviews.landlord.averageRating ?? '-'} ({reviews.landlord.totalCount} reviews)
          </Text>
          <Button mt="12px" size="sm" onClick={handleContact} loading={isContacting}>
            Message Landlord
          </Button>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="16px" mb="16px">
        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="10px">
            Rental Situation
          </Text>
          <SimpleGrid columns={{ base: 2, md: 3 }} gap="8px" mb="10px">
            <Box border="1px solid" borderColor={borderColor} borderRadius="10px" p="8px">
              <Text fontSize="xs" color={textSecondary}>
                Total Applications
              </Text>
              <Text fontWeight="700" color={textPrimary}>
                {rentalInsight.totalApplications}
              </Text>
            </Box>
            <Box border="1px solid" borderColor={borderColor} borderRadius="10px" p="8px">
              <Text fontSize="xs" color={textSecondary}>
                Under Review
              </Text>
              <Text fontWeight="700" color={textPrimary}>
                {rentalInsight.underReviewCount}
              </Text>
            </Box>
            <Box border="1px solid" borderColor={borderColor} borderRadius="10px" p="8px">
              <Text fontSize="xs" color={textSecondary}>
                Shortlisted
              </Text>
              <Text fontWeight="700" color={textPrimary}>
                {rentalInsight.shortlistedCount}
              </Text>
            </Box>
            <Box border="1px solid" borderColor={borderColor} borderRadius="10px" p="8px">
              <Text fontSize="xs" color={textSecondary}>
                Approved
              </Text>
              <Text fontWeight="700" color={textPrimary}>
                {rentalInsight.approvedCount}
              </Text>
            </Box>
            <Box border="1px solid" borderColor={borderColor} borderRadius="10px" p="8px">
              <Text fontSize="xs" color={textSecondary}>
                Listing Status
              </Text>
              <Text fontWeight="700" color={textPrimary}>
                {formatListingStatus(rentalInsight.listingStatus)}
              </Text>
            </Box>
            <Box border="1px solid" borderColor={borderColor} borderRadius="10px" p="8px">
              <Text fontSize="xs" color={textSecondary}>
                My Open Repairs
              </Text>
              <Text fontWeight="700" color={textPrimary}>
                {actions.myOpenMaintenanceCount}
              </Text>
            </Box>
          </SimpleGrid>

          {rentalInsight.myApplication ? (
            <Box bg={subtleBg} p="10px" borderRadius="10px">
              <Text color={textSecondary} fontSize="xs">
                Your Application
              </Text>
              <Text color={textPrimary} fontWeight="700">
                {formatListingStatus(rentalInsight.myApplication.status)}
              </Text>
              <Text color={textSecondary} fontSize="xs">
                Submitted: {formatDate(rentalInsight.myApplication.submittedAt)}
              </Text>
            </Box>
          ) : (
            <Text color={textSecondary} fontSize="sm">
              You have not applied for this listing yet.
            </Text>
          )}
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
              <Input
                type="number"
                min={0}
                placeholder="Offer weekly rent (optional)"
                value={offerWeeklyRentInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setOfferWeeklyRentInput(event.target.value)}
                mb="8px"
              />
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

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="16px" mb="16px">
        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="10px">
            Property Review History
          </Text>
          <Text color={textSecondary} fontSize="sm" mb="10px">
            Average: {reviews.property.averageRating ?? '-'} ({reviews.property.totalCount} reviews)
          </Text>
          {reviews.property.recent.length === 0 ? (
            <Text color={textSecondary} fontSize="sm">
              No public property reviews yet.
            </Text>
          ) : (
            <Flex direction="column" gap="10px">
              {reviews.property.recent.map((review) => (
                <Box key={review.id} border="1px solid" borderColor={borderColor} borderRadius="10px" p="10px">
                  <Flex justify="space-between" align="center" mb="4px" gap="8px">
                    <Text color={textPrimary} fontWeight="700" fontSize="sm">
                      {review.reviewerName}
                    </Text>
                    <Text color={textSecondary} fontSize="xs">
                      {review.rating}/5
                    </Text>
                  </Flex>
                  <Text color={textPrimary} fontSize="sm" fontWeight="600">
                    {review.title || 'Review'}
                  </Text>
                  <Text color={textSecondary} fontSize="sm" mb="4px">
                    {review.body || '-'}
                  </Text>
                  <Text color={textSecondary} fontSize="xs">
                    {formatDate(review.createdAt)} {review.isVerifiedInteraction ? '• Verified' : ''}
                  </Text>
                </Box>
              ))}
            </Flex>
          )}
        </Card>

        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="10px">
            Contact Landlord
          </Text>
          <Text color={textSecondary} fontSize="sm" mb="8px">
            Send a direct enquiry. Conversation will appear in Messages.
          </Text>
          <Textarea
            placeholder="Hi, I am interested in this property. Is inspection available this week?"
            minH="140px"
            value={contactMessage}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setContactMessage(event.target.value)}
            mb="10px"
          />
          <Flex gap="8px" wrap="wrap">
            <Button loading={isContacting} onClick={handleContact}>
              Send Message
            </Button>
            <Button variant="outline" as={NextLink} href="/admin/messages">
              Open Messages
            </Button>
          </Flex>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="16px">
        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="10px">
            Rate This Property
          </Text>
          {!actions.canReview ? (
            <Text color={textSecondary} fontSize="sm">
              You can rate this property after your rental application is approved.
            </Text>
          ) : (
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
          )}
        </Card>

        <Card p="16px" bg={cardBg}>
          <Text color={textPrimary} fontWeight="700" mb="10px">
            Maintenance Request
          </Text>
          {!actions.canRequestMaintenance ? (
            <Text color={textSecondary} fontSize="sm">
              Maintenance request is available once you are approved for this tenancy.
            </Text>
          ) : (
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
          )}
        </Card>
      </SimpleGrid>
    </Box>
  );
}
