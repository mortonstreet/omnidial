import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import type {
  GetAnalyticsResponse,
  GetLeaderboardResponse,
} from '@shared/types/src';

interface UseAnalyticsCallsOptions {
  organizationId: string | undefined;
  startDate: string;
  endDate: string;
  userId?: string;
  campaignId?: string;
  clientId?: string;
  enabled?: boolean;
}

interface UseAnalyticsLeaderboardOptions {
  organizationId: string | undefined;
  startDate: string;
  endDate: string;
  campaignId?: string;
  clientId?: string;
  enabled?: boolean;
}

/**
 * Hook to fetch call analytics data (metrics, charts, dispositions)
 */
export function useAnalyticsCalls({
  organizationId,
  startDate,
  endDate,
  userId,
  campaignId,
  clientId,
  enabled = true,
}: UseAnalyticsCallsOptions) {
  const filters = { userId, campaignId, clientId };

  return useQuery<{ data: GetAnalyticsResponse }>({
    queryKey: QUERY_KEYS.analyticsCalls(organizationId, startDate, endDate, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      if (userId) params.append('userId', userId);
      if (campaignId) params.append('campaignId', campaignId);
      if (clientId) params.append('clientId', clientId);

      const url = `${ENDPOINTS.ANALYTICS.CALLS(organizationId!)}?${params.toString()}`;
      return get<{ data: GetAnalyticsResponse }>(url);
    },
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    placeholderData: {
      data: {
        metrics: {
          totalCalls: 0,
          outboundCalls: 0,
          inboundCalls: 0,
          connectedCalls: 0,
          connectionRate: 0,
          totalTalkTimeSeconds: 0,
          avgCallDurationSeconds: 0,
        },
        dispositionBreakdown: [],
        callsOverTime: [],
      },
    },
  });
}

/**
 * Hook to fetch leaderboard data
 */
export function useAnalyticsLeaderboard({
  organizationId,
  startDate,
  endDate,
  campaignId,
  clientId,
  enabled = true,
}: UseAnalyticsLeaderboardOptions) {
  const filters = { campaignId, clientId };

  return useQuery<{ data: GetLeaderboardResponse }>({
    queryKey: QUERY_KEYS.analyticsLeaderboard(organizationId, startDate, endDate, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      if (campaignId) params.append('campaignId', campaignId);
      if (clientId) params.append('clientId', clientId);

      const url = `${ENDPOINTS.ANALYTICS.LEADERBOARD(organizationId!)}?${params.toString()}`;
      return get<{ data: GetLeaderboardResponse }>(url);
    },
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    placeholderData: {
      data: {
        leaderboard: [],
      },
    },
  });
}
