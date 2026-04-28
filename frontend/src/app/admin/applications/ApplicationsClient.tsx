'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import Card from 'components/card/Card';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Image,
  Skeleton,
  Text,
  useColorModeValue,
} from 'lib/chakra';
import {
  ApplicationsData,
  ApplicationSummary,
  LandlordApplicationDocument,
  LandlordApplicationItem,
  TenantApplicationItem,
  loadApplications,
  setApplicationStatus,
} from 'lib/applications/applicationsClient';

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusToTone(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === 'SUBMITTED') {
    return 'blue';
  }

  if (normalized === 'UNDER_REVIEW') {
    return 'yellow';
  }

  if (normalized === 'SHORTLISTED') {
    return 'purple';
  }

  if (normalized === 'APPROVED') {
    return 'green';
  }

  if (normalized === 'REJECTED' || normalized === 'DECLINED' || normalized === 'WITHDRAWN' || normalized === 'EXPIRED') {
    return 'red';
  }

  return 'gray';
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return `$${Math.round(value)}`;
}

function SummaryGrid({
  summary,
  panelBg,
  textPrimary,
  textSecondary,
}: {
  summary: ApplicationSummary;
  panelBg: string;
  textPrimary: string;
  textSecondary: string;
}) {
  const items = [
    { label: 'Submitted', count: summary.submittedCount },
    { label: 'Under Review', count: summary.underReviewCount },
    { label: 'Shortlisted', count: summary.shortlistedCount },
    { label: 'Approved', count: summary.approvedCount },
    { label: 'Rejected', count: summary.rejectedCount },
  ];

  return (
    <Grid templateColumns={{ base: 'repeat(2, 1fr)', xl: 'repeat(5, 1fr)' }} gap="12px" mb="16px">
      {items.map((item) => (
        <Card key={item.label} p="14px" bg={panelBg}>
          <Text fontSize="xs" color={textSecondary} mb="4px">
            {item.label}
          </Text>
          <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
            {item.count}
          </Text>
        </Card>
      ))}
    </Grid>
  );
}

function TenantListSection({
  title,
  emptyText,
  items,
  panelBg,
  borderColor,
  textPrimary,
  textSecondary,
}: {
  title: string;
  emptyText: string;
  items: TenantApplicationItem[];
  panelBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <Card p="0" bg={panelBg} mb="16px">
      <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor} align="center">
        <Text fontSize="md" fontWeight="700" color={textPrimary}>
          {title}
        </Text>
      </Flex>

      {items.length === 0 ? (
        <Box p="16px">
          <Text color={textSecondary} fontSize="sm">
            {emptyText}
          </Text>
        </Box>
      ) : (
        items.map((item) => (
          <Flex
            key={item.id}
            px="16px"
            py="14px"
            borderBottom="1px solid"
            borderColor={borderColor}
            align="center"
            justify="space-between"
            gap="12px"
            wrap="wrap"
          >
            <Box minW="240px" flex="1">
              <Text fontWeight="700" color={textPrimary}>
                {item.listing?.title || 'Listing'}
              </Text>
              <Text fontSize="sm" color={textSecondary}>
                {item.property
                  ? `${item.property.addressLine1}, ${item.property.suburb} ${item.property.state} ${item.property.postcode}`
                  : 'Address unavailable'}
              </Text>
              <Text fontSize="sm" color={textSecondary}>
                Submitted {formatDate(item.submittedAt)} · Updated {formatDate(item.lastStatusAt)}
              </Text>
              {item.message ? (
                <Text fontSize="sm" color={textSecondary} mt="4px" noOfLines={2}>
                  Note: {item.message}
                </Text>
              ) : null}
            </Box>

            <Flex align="center" gap="8px" wrap="wrap" justify={{ base: 'flex-start', md: 'flex-end' }}>
              <Badge colorScheme={statusToTone(item.status)}>{formatStatus(item.status)}</Badge>
              <Button as={NextLink} href={`/admin/listings/${item.listingId}`} size="sm" variant="outline">
                View Listing
              </Button>
            </Flex>
          </Flex>
        ))
      )}
    </Card>
  );
}

export default function ApplicationsClient() {
  const { showNotice } = useGlobalNotice();
  const [data, setData] = useState<ApplicationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingByApplicationId, setUpdatingByApplicationId] = useState<Record<string, boolean>>({});

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocuments, setPreviewDocuments] = useState<LandlordApplicationDocument[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const modalBg = useColorModeValue('rgba(10, 12, 25, 0.72)', 'rgba(0, 0, 0, 0.82)');
  const previewCardBg = useColorModeValue('white', 'navy.800');

  const currentPreview = useMemo(() => {
    if (!previewOpen || previewDocuments.length === 0) {
      return null;
    }

    return previewDocuments[Math.min(Math.max(previewIndex, 0), previewDocuments.length - 1)] ?? null;
  }, [previewDocuments, previewIndex, previewOpen]);

  const refreshApplications = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const result = await loadApplications();
        if (!result.ok || !result.data) {
          throw new Error(result.message || 'Failed to load applications.');
        }

        setData(result.data);
        setLoadError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load applications.';
        setLoadError(message);

        if (mode === 'refresh') {
          showNotice({ type: 'error', message });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showNotice],
  );

  const handleStatusChange = useCallback(
    async (applicationId: string, status: 'UNDER_REVIEW' | 'SHORTLISTED' | 'APPROVED' | 'REJECTED') => {
      setUpdatingByApplicationId((current) => ({ ...current, [applicationId]: true }));
      try {
        const result = await setApplicationStatus({ applicationId, status });
        if (!result.ok) {
          throw new Error(result.message || 'Failed to update application status.');
        }

        showNotice({ type: 'success', message: result.message || 'Application updated.' });
        await refreshApplications();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update application status.';
        showNotice({ type: 'error', message });
      } finally {
        setUpdatingByApplicationId((current) => ({ ...current, [applicationId]: false }));
      }
    },
    [refreshApplications, showNotice],
  );

  const openPreview = useCallback((documents: LandlordApplicationDocument[], index: number) => {
    if (documents.length === 0) {
      return;
    }

    setPreviewDocuments(documents);
    setPreviewIndex(index);
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewDocuments([]);
    setPreviewIndex(0);
  }, []);

  useEffect(() => {
    void refreshApplications('initial');
  }, [refreshApplications]);

  if (isLoading) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Skeleton h="34px" borderRadius="10px" mb="12px" />
        <Skeleton h="84px" borderRadius="12px" mb="12px" />
        <Skeleton h="260px" borderRadius="12px" />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Card p="16px" bg={panelBg}>
          <Text color={textPrimary} fontWeight="700" mb="8px">
            Unable to load applications
          </Text>
          <Text color={textSecondary} fontSize="sm" mb="12px">
            {loadError || 'Please refresh and try again.'}
          </Text>
          <Button size="sm" onClick={() => void refreshApplications('refresh')} loading={isRefreshing}>
            Retry
          </Button>
        </Card>
      </Box>
    );
  }

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Flex mb="16px" align="center" justify="space-between" wrap="wrap" gap="8px">
        <Box>
          <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
            Applications
          </Text>
          <Text fontSize="sm" color={textSecondary}>
            {data.role === 'LANDLORD'
              ? 'Review rental applications, inspect uploaded documents, and approve outcomes.'
              : 'Track your application progress and latest landlord decisions.'}
          </Text>
        </Box>
        <Button size="sm" onClick={() => void refreshApplications('refresh')} loading={isRefreshing}>
          Refresh
        </Button>
      </Flex>

      <SummaryGrid summary={data.summary} panelBg={panelBg} textPrimary={textPrimary} textSecondary={textSecondary} />

      {data.role === 'TENANT' ? (
        <>
          <TenantListSection
            title="Active Applications"
            emptyText="No active applications."
            items={data.activeApplications}
            panelBg={panelBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
          <TenantListSection
            title="Application History"
            emptyText="No history records yet."
            items={data.historyApplications}
            panelBg={panelBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
        </>
      ) : (
        <Card p="0" bg={panelBg}>
          <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor} align="center">
            <Text fontSize="md" fontWeight="700" color={textPrimary}>
              Incoming Applications
            </Text>
          </Flex>

          {data.applications.length === 0 ? (
            <Box p="16px">
              <Text color={textSecondary} fontSize="sm">
                No rental applications yet.
              </Text>
            </Box>
          ) : (
            data.applications.map((item: LandlordApplicationItem) => {
              const docs = item.documents.filter((doc) => Boolean(doc.url));
              const isUpdating = Boolean(updatingByApplicationId[item.id]);

              return (
                <Box key={item.id} px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
                  <Flex justify="space-between" align="flex-start" gap="12px" wrap="wrap" mb="10px">
                    <Box flex="1" minW="240px">
                      <Text fontWeight="700" color={textPrimary}>
                        {item.listing?.title || 'Listing'}
                      </Text>
                      <Text fontSize="sm" color={textSecondary}>
                        {item.property
                          ? `${item.property.addressLine1}, ${item.property.suburb} ${item.property.state} ${item.property.postcode}`
                          : 'Address unavailable'}
                      </Text>
                      <Text fontSize="sm" color={textSecondary}>
                        Applicant: {item.applicant.name}
                        {item.applicant.email ? ` (${item.applicant.email})` : ''}
                      </Text>
                      <Text fontSize="sm" color={textSecondary}>
                        Submitted {formatDate(item.submittedAt)} · Last update {formatDate(item.lastStatusAt)}
                      </Text>
                      <Text fontSize="sm" color={textSecondary}>
                        Offer rent: {formatMoney(item.offerWeeklyRent)} / week
                      </Text>
                      {item.message ? (
                        <Text fontSize="sm" color={textSecondary} mt="4px" noOfLines={3}>
                          Applicant note: {item.message}
                        </Text>
                      ) : null}
                    </Box>

                    <Flex direction="column" align={{ base: 'flex-start', md: 'flex-end' }} gap="8px">
                      <Badge colorScheme={statusToTone(item.status)}>{formatStatus(item.status)}</Badge>
                      <Button
                        as={NextLink}
                        href={item.listing?.id ? `/admin/listings/${item.listing.id}` : '/admin/listings'}
                        size="sm"
                        variant="outline"
                        disabled={!item.listing?.id}
                      >
                        View Listing
                      </Button>
                    </Flex>
                  </Flex>

                  <Box mb="12px">
                    <Text fontSize="sm" fontWeight="700" color={textPrimary} mb="8px">
                      Uploaded Verification Materials
                    </Text>
                    {docs.length === 0 ? (
                      <Text fontSize="sm" color={textSecondary}>
                        No uploaded documents found for this applicant.
                      </Text>
                    ) : (
                      <Flex gap="8px" overflowX="auto" py="2px">
                        {docs.map((doc, index) => (
                          <Box
                            key={doc.id}
                            minW="92px"
                            border="1px solid"
                            borderColor={borderColor}
                            borderRadius="10px"
                            overflow="hidden"
                            cursor="pointer"
                            onClick={() => openPreview(docs, index)}
                          >
                            <Image
                              src={doc.url || ''}
                              alt={doc.label}
                              w="92px"
                              h="72px"
                              objectFit="cover"
                              bg="gray.100"
                            />
                            <Box p="6px">
                              <Text fontSize="xs" color={textPrimary} noOfLines={1}>
                                {doc.label}
                              </Text>
                              <Text fontSize="10px" color={doc.isVerified ? 'green.500' : textSecondary}>
                                {doc.isVerified ? 'Verified' : 'Pending'}
                              </Text>
                            </Box>
                          </Box>
                        ))}
                      </Flex>
                    )}
                  </Box>

                  <Flex gap="8px" wrap="wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={isUpdating}
                      disabled={isUpdating}
                      onClick={() => void handleStatusChange(item.id, 'UNDER_REVIEW')}
                    >
                      Under Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={isUpdating}
                      disabled={isUpdating}
                      onClick={() => void handleStatusChange(item.id, 'SHORTLISTED')}
                    >
                      Shortlist
                    </Button>
                    <Button
                      size="sm"
                      loading={isUpdating}
                      disabled={isUpdating}
                      onClick={() => void handleStatusChange(item.id, 'APPROVED')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={isUpdating}
                      disabled={isUpdating}
                      onClick={() => void handleStatusChange(item.id, 'REJECTED')}
                    >
                      Reject
                    </Button>
                  </Flex>
                </Box>
              );
            })
          )}
        </Card>
      )}

      {previewOpen && currentPreview ? (
        <Box position="fixed" inset="0" zIndex={1800} bg={modalBg} display="flex" alignItems="center" justifyContent="center" p="16px">
          <Box w="100%" maxW="900px" bg={previewCardBg} borderRadius="14px" border="1px solid" borderColor={borderColor} overflow="hidden">
            <Flex align="center" justify="space-between" px="14px" py="10px" borderBottom="1px solid" borderColor={borderColor}>
              <Text color={textPrimary} fontWeight="700" fontSize="sm">
                {currentPreview.label} ({previewIndex + 1}/{previewDocuments.length})
              </Text>
              <Button size="xs" variant="outline" onClick={closePreview}>
                Close
              </Button>
            </Flex>

            <Box p="12px">
              <Image
                src={currentPreview.url || ''}
                alt={currentPreview.label}
                w="100%"
                h={{ base: '300px', md: '520px' }}
                objectFit="contain"
                bg="gray.100"
                borderRadius="10px"
              />
            </Box>

            <Flex px="14px" pb="12px" justify="space-between" align="center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewIndex((current) => Math.max(0, current - 1))}
                disabled={previewIndex <= 0}
              >
                Previous
              </Button>
              <Text color={textSecondary} fontSize="sm">
                Updated {formatDate(currentPreview.updatedAt)}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewIndex((current) => Math.min(previewDocuments.length - 1, current + 1))}
                disabled={previewIndex >= previewDocuments.length - 1}
              >
                Next
              </Button>
            </Flex>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
