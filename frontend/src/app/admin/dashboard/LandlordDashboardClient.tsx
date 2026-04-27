'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import Card from 'components/card/Card';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';
import { Badge, Box, Button, Flex, Grid, Skeleton, Text, useColorModeValue } from 'lib/chakra';
import { loadLandlordDashboard, LandlordDashboardData } from 'lib/landlord/dashboardClient';
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

export default function LandlordDashboardClient() {
  const { showNotice } = useGlobalNotice();
  const [metrics, setMetrics] = useState<LandlordDashboardData>(EMPTY_DASHBOARD);
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
        const result = await loadLandlordDashboard();
        if (!result.ok || !result.data) {
          throw new Error(result.message || 'Failed to load dashboard.');
        }

        setMetrics(result.data);
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

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }} gap="12px" mb="16px">
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

      <Card p="0" bg={panelBg}>
        <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor} align="center" justify="space-between" gap="8px" wrap="wrap">
          <Text fontSize="md" fontWeight="700" color={textPrimary}>
            快捷操作
          </Text>
          <Flex gap="8px" wrap="wrap">
            <Button as={NextLink} href="/admin/properties" size="sm">
              Manage Properties
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
    </Box>
  );
}
