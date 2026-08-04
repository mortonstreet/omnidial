import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import type {
  AnalyticsPeriod,
  RepProfileStatsResponse,
} from '@shared/types/src/requests/repProfile';

interface UseRepProfileStatsOptions {
  organizationId: string | undefined;
  userId: string | undefined;
  period?: AnalyticsPeriod;
  campaignId?: string;
  refresh?: boolean;
  enabled?: boolean;
}

/**
 * Hook to fetch rep profile stats with AM/PM analytics
 */
export function useRepProfileStats({
  organizationId,
  userId,
  period = 'week',
  campaignId,
  refresh = false,
  enabled = true,
}: UseRepProfileStatsOptions) {
  return useQuery<{ data: RepProfileStatsResponse }>({
    queryKey: QUERY_KEYS.repProfileStats(organizationId, userId, period, { campaignId }),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', period);
      if (campaignId) params.append('campaignId', campaignId);
      if (refresh) params.append('refresh', 'true');

      const url = `${ENDPOINTS.REP_PROFILES.STATS(organizationId!, userId!)}?${params.toString()}`;
      return get<{ data: RepProfileStatsResponse }>(url);
    },
    enabled: enabled && !!organizationId && !!userId,
    staleTime: period === 'today' ? 60 * 1000 : period === 'week' ? 5 * 60 * 1000 : period === 'month' ? 15 * 60 * 1000 : 30 * 60 * 1000,
  });
}
