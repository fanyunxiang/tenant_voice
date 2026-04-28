'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import Card from 'components/card/Card';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Select,
  Skeleton,
  Text,
  useColorModeValue,
} from 'lib/chakra';
import {
  assignLandlordMaintenanceWorker,
  LandlordDashboardData,
  LandlordMaintenanceRequestItem,
  loadLandlordDashboard,
  loadLandlordMaintenanceRequests,
} from 'lib/landlord/dashboardClient';
import { loadSession } from 'lib/auth/client';

const EMPTY_DASHBOARD: LandlordDashboardData = {
  inRentCount: 0,
  pendingRentCount: 0,
  maintenanceCount: 0,
  pendingApplicationsCount: 0,
  unreadMessagesCount: 0,
};

type MetricCard = {
  key: keyof LandlordDashboardData;
  label: string;
  note: string;
};

const METRICS: MetricCard[] = [
  { key: 'inRentCount', label: '在租几套', note: '当前出租中的房源' },
  { key: 'pendingRentCount', label: '待租几套', note: '草稿/上架/暂停中的房源' },
  { key: 'maintenanceCount', label: '维修几套', note: '存在未关闭维修工单的房源' },
  { key: 'pendingApplicationsCount', label: '待处理申请', note: '待审申请数量' },
  { key: 'unreadMessagesCount', label: '未读消息', note: '聊天中的未读消息数' },
];

const MOCK_MAINTENANCE_WORKERS = [
  { id: 'plumber-jack', workerType: 'PLUMBER', workerName: 'Jack Li', label: 'Jack Li · Plumber' },
  { id: 'plumber-emma', workerType: 'PLUMBER', workerName: 'Emma Zhao', label: 'Emma Zhao · Plumber' },
  { id: 'electrician-mason', workerType: 'ELECTRICIAN', workerName: 'Mason Chen', label: 'Mason Chen · Electrician' },
  { id: 'electrician-olivia', workerType: 'ELECTRICIAN', workerName: 'Olivia Wang', label: 'Olivia Wang · Electrician' },
  { id: 'general-aaron', workerType: 'GENERAL', workerName: 'Aaron Patel', label: 'Aaron Patel · General Repair' },
];

function formatDate(iso: string | null | undefined) {
  if (!iso) {
    return '-';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString();
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusColor(value: string) {
  const normalized = value.toUpperCase();
  if (normalized === 'OPEN') {
    return 'orange';
  }
  if (normalized === 'IN_REVIEW') {
    return 'blue';
  }
  if (normalized === 'ESCALATED') {
    return 'red';
  }
  if (normalized === 'RESOLVED' || normalized === 'CLOSED') {
    return 'green';
  }
  return 'gray';
}

export default function LandlordDashboardClient() {
  const { showNotice } = useGlobalNotice();
  const [metrics, setMetrics] = useState<LandlordDashboardData>(EMPTY_DASHBOARD);
  const [maintenanceRequests, setMaintenanceRequests] = useState<LandlordMaintenanceRequestItem[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<Record<string, string>>({});
  const [assigningByComplaintId, setAssigningByComplaintId] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLandlord, setIsLandlord] = useState<boolean | null>(null);

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');

  const highPriorityCount = useMemo(() => {
    return metrics.pendingApplicationsCount + metrics.unreadMessagesCount + metrics.maintenanceCount;
  }, [metrics]);

  const refreshDashboard = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const [dashboardResult, maintenanceResult] = await Promise.all([
          loadLandlordDashboard(),
          loadLandlordMaintenanceRequests(),
        ]);

        if (!dashboardResult.ok || !dashboardResult.data) {
          throw new Error(dashboardResult.message || 'Failed to load dashboard.');
        }

        if (!maintenanceResult.ok || !maintenanceResult.data) {
          throw new Error(maintenanceResult.message || 'Failed to load maintenance requests.');
        }

        setMetrics(dashboardResult.data);
        setMaintenanceRequests(maintenanceResult.data.requests);
        setLoadError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load dashboard.';
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

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const sessionResult = await loadSession();
        if (cancelled) {
          return;
        }

        const landlord = Boolean(sessionResult.ok && sessionResult.user?.primary_role === 'LANDLORD');
        setIsLandlord(landlord);

        if (landlord) {
          await refreshDashboard('initial');
        } else {
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsLandlord(false);
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [refreshDashboard]);

  const handleAssignWorker = useCallback(
    async (requestItem: LandlordMaintenanceRequestItem) => {
      const selectedWorkerId = selectedWorkers[requestItem.id];
      if (!selectedWorkerId) {
        showNotice({ type: 'error', message: 'Please select a worker first.' });
        return;
      }

      const worker = MOCK_MAINTENANCE_WORKERS.find((item) => item.id === selectedWorkerId);
      if (!worker) {
        showNotice({ type: 'error', message: 'Selected worker is invalid.' });
        return;
      }

      setAssigningByComplaintId((current) => ({ ...current, [requestItem.id]: true }));

      try {
        const result = await assignLandlordMaintenanceWorker({
          complaintId: requestItem.id,
          workerType: worker.workerType,
          workerName: worker.workerName,
        });

        if (!result.ok) {
          throw new Error(result.message || 'Failed to assign worker.');
        }

        showNotice({ type: 'success', message: result.message || 'Worker assigned.' });
        await refreshDashboard('refresh');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to assign worker.';
        showNotice({ type: 'error', message });
      } finally {
        setAssigningByComplaintId((current) => ({ ...current, [requestItem.id]: false }));
      }
    },
    [refreshDashboard, selectedWorkers, showNotice],
  );

  if (isLandlord === false) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Card p="18px" bg={panelBg}>
          <Text color={textPrimary} fontWeight="700" mb="6px">
            Dashboard is landlord-only
          </Text>
          <Text color={textSecondary} fontSize="sm" mb="12px">
            当前账号不是房东角色，请使用租客菜单页面。
          </Text>
          <Button as={NextLink} href="/admin/listings" size="sm">
            Go to Listings
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
            Dashboard
          </Text>
          <Text fontSize="sm" color={textSecondary}>
            房东看板：房源状态、待处理申请与消息提醒。
          </Text>
        </Box>

        <Flex gap="8px" align="center">
          <Badge colorScheme={highPriorityCount > 0 ? 'orange' : 'green'} borderRadius="999px" px="10px" py="6px">
            Priority {highPriorityCount}
          </Badge>
          <Button size="sm" onClick={() => void refreshDashboard()} loading={isRefreshing}>
            Refresh
          </Button>
        </Flex>
      </Flex>

      <Grid
        templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }}
        gap="12px"
        mb="16px"
      >
        {METRICS.map((metric) => (
          <Card key={metric.key} p="14px" bg={panelBg}>
            {isLoading ? (
              <Skeleton h="58px" borderRadius="8px" />
            ) : (
              <>
                <Text fontSize="xs" color={textSecondary} mb="6px">
                  {metric.label}
                </Text>
                <Text fontSize="2xl" lineHeight="1.1" fontWeight="700" color={textPrimary} mb="4px">
                  {metrics[metric.key]}
                </Text>
                <Text fontSize="xs" color={textSecondary}>
                  {metric.note}
                </Text>
              </>
            )}
          </Card>
        ))}
      </Grid>

      <Card p="0" bg={panelBg} mb="16px">
        <Flex
          px="16px"
          py="14px"
          borderBottom="1px solid"
          borderColor={borderColor}
          align="center"
          justify="space-between"
          gap="8px"
          wrap="wrap"
        >
          <Text fontSize="md" fontWeight="700" color={textPrimary}>
            快捷操作
          </Text>
          <Flex gap="8px" wrap="wrap">
            <Button as={NextLink} href="/admin/properties" size="sm">
              Manage Properties
            </Button>
            <Button as={NextLink} href="/admin/applications" size="sm" variant="outline">
              Review Applications
            </Button>
            <Button as={NextLink} href="/admin/messages" size="sm" variant="outline">
              Open Messages
            </Button>
            <Button as={NextLink} href="/admin/profile" size="sm" variant="outline">
              Edit Profile
            </Button>
          </Flex>
        </Flex>

        <Box p="16px">
          {loadError ? (
            <Text fontSize="sm" color={textSecondary}>
              {loadError}
            </Text>
          ) : (
            <Text fontSize="sm" color={textSecondary}>
              数据来源：你名下房源、维修投诉、租赁申请与会话未读记录。
            </Text>
          )}
        </Box>
      </Card>

      <Card p="0" bg={panelBg}>
        <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor} align="center" justify="space-between" gap="8px" wrap="wrap">
          <Text fontSize="md" fontWeight="700" color={textPrimary}>
            Maintenance Requests
          </Text>
          <Badge colorScheme={maintenanceRequests.length > 0 ? 'orange' : 'green'}>{maintenanceRequests.length}</Badge>
        </Flex>

        {isLoading ? (
          <Box p="16px">
            <Skeleton h="72px" borderRadius="10px" />
          </Box>
        ) : maintenanceRequests.length === 0 ? (
          <Box p="16px">
            <Text fontSize="sm" color={textSecondary}>
              No active maintenance requests.
            </Text>
          </Box>
        ) : (
          maintenanceRequests.map((requestItem) => (
            <Box key={requestItem.id} px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
              <Flex justify="space-between" align="flex-start" gap="10px" wrap="wrap" mb="8px">
                <Box minW="260px" flex="1">
                  <Text color={textPrimary} fontWeight="700">
                    {requestItem.listingTitle}
                  </Text>
                  <Text color={textSecondary} fontSize="sm">
                    {requestItem.property
                      ? `${requestItem.property.addressLine1}, ${requestItem.property.suburb} ${requestItem.property.state} ${requestItem.property.postcode}`
                      : 'Property address unavailable'}
                  </Text>
                  <Text color={textSecondary} fontSize="sm">
                    Tenant: {requestItem.tenantName}
                    {requestItem.tenantEmail ? ` (${requestItem.tenantEmail})` : ''}
                  </Text>
                  <Text color={textSecondary} fontSize="sm">
                    Category: {formatStatus(requestItem.category)} · Severity: {formatStatus(requestItem.severity)}
                  </Text>
                  <Text color={textSecondary} fontSize="sm">
                    Lodged: {formatDate(requestItem.lodgedAt)}
                  </Text>
                  <Text color={textSecondary} fontSize="sm" mt="4px">
                    {requestItem.description}
                  </Text>
                </Box>

                <Flex direction="column" align={{ base: 'flex-start', md: 'flex-end' }} gap="6px">
                  <Badge colorScheme={statusColor(requestItem.status)}>{formatStatus(requestItem.status)}</Badge>
                  {requestItem.assignedWorker ? (
                    <Text fontSize="xs" color={textSecondary} textAlign={{ base: 'left', md: 'right' }}>
                      Assigned: {requestItem.assignedWorker.workerName} ({requestItem.assignedWorker.workerType})
                    </Text>
                  ) : (
                    <Text fontSize="xs" color={textSecondary}>
                      Not assigned
                    </Text>
                  )}
                </Flex>
              </Flex>

              <Flex gap="8px" wrap="wrap" align="center">
                <Box minW={{ base: '100%', md: '290px' }}>
                  <Select
                    value={selectedWorkers[requestItem.id] || ''}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setSelectedWorkers((current) => ({ ...current, [requestItem.id]: event.target.value }))
                    }
                  >
                    <option value="">Select mock worker...</option>
                    {MOCK_MAINTENANCE_WORKERS.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.label}
                      </option>
                    ))}
                  </Select>
                </Box>
                <Button
                  size="sm"
                  loading={Boolean(assigningByComplaintId[requestItem.id])}
                  onClick={() => void handleAssignWorker(requestItem)}
                >
                  Assign Worker
                </Button>
                {requestItem.listingId ? (
                  <Button as={NextLink} href={`/admin/listings/${requestItem.listingId}`} size="sm" variant="outline">
                    Open Listing
                  </Button>
                ) : null}
              </Flex>
            </Box>
          ))
        )}
      </Card>
    </Box>
  );
}
