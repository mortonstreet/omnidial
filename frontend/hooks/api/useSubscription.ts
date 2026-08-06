import { useQuery } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { ENDPOINTS, QUERY_KEYS } from "@/lib/config";
import { get } from "@/lib/api";
import { AppFeature, PlanTier, planHasFeature } from "@shared/types/src/stripe";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

interface SubscriptionInfo {
  subscription: {
    id: string;
    plan: string;
    status: string;
    seats: number;
    trialEnd?: string;
    periodEnd?: string;
  } | null;
  tier: PlanTier | null;
  isTrialing: boolean;
}

export const useSubscriptionInfo = () => {
  const { data: activeOrganization } = useActiveOrganization();
  const orgId = activeOrganization?.id;

  return useQuery<SubscriptionInfo>({
    queryKey: QUERY_KEYS.organizationSubscription(orgId),
    queryFn: async () => {
      if (!orgId) return { subscription: null, tier: null, isTrialing: false };
      return get<SubscriptionInfo>(ENDPOINTS.ORGANIZATION.SUBSCRIPTION(orgId));
    },
    enabled: !!orgId,
  });
};

export const useCanAccessFeature = (feature: AppFeature) => {
  const { data, isLoading } = useSubscriptionInfo();
  const isSuperAdmin = useSuperAdmin();

  if (isSuperAdmin) {
    return { canAccess: true, isLoading: false, tier: "pro" as PlanTier };
  }

  if (isLoading || !data) {
    return { canAccess: false, isLoading, tier: null as PlanTier | null };
  }

  // No subscription = no access
  if (!data.subscription || !data.tier) {
    return { canAccess: false, isLoading: false, tier: null };
  }

  // During trial, grant Pro-level access
  if (data.isTrialing) {
    return { canAccess: true, isLoading: false, tier: data.tier };
  }

  return {
    canAccess: planHasFeature(data.tier, feature),
    isLoading: false,
    tier: data.tier,
  };
};
