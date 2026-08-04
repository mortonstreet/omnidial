import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/lib/api';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { useActiveOrganization } from '@/lib/auth-client';
import type {
  GetUsageDashboardResponse,
  GetUsageHistoryResponse,
  AcknowledgeOverageCapResponse,
} from '@shared/types/src/requests/billing';

export function useUsageDashboard() {
  const { data: activeOrganization } = useActiveOrganization();
  const orgId = activeOrganization?.id;

  return useQuery({
    queryKey: QUERY_KEYS.billingUsage(orgId),
    queryFn: () =>
      get<{ data: GetUsageDashboardResponse }>(ENDPOINTS.BILLING.USAGE),
    enabled: !!orgId,
    refetchInterval: 60_000, // Refresh every minute for real-time feel
  });
}

export function useUsageHistory() {
  const { data: activeOrganization } = useActiveOrganization();
  const orgId = activeOrganization?.id;

  return useQuery({
    queryKey: QUERY_KEYS.billingUsageHistory(orgId),
    queryFn: () =>
      get<{ data: GetUsageHistoryResponse }>(ENDPOINTS.BILLING.USAGE_HISTORY),
    enabled: !!orgId,
  });
}

export function useAcknowledgeOverageCap() {
  const queryClient = useQueryClient();
  const { data: activeOrganization } = useActiveOrganization();
  const orgId = activeOrganization?.id;

  return useMutation({
    mutationFn: (additionalCapCents?: number) =>
      post<{ data: AcknowledgeOverageCapResponse }>(
        ENDPOINTS.BILLING.OVERAGE_CAP_ACKNOWLEDGE,
        { additionalCapCents },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.billingUsage(orgId),
      });
    },
  });
}
