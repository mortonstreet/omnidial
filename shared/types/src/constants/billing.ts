export const PLAN_USAGE_CONFIG = {
  'starter-monthly': {
    name: 'Starter',
    tier: 'starter' as const,
    includedMinutes: 500,
    overageRateCents: 15, // $0.015/min stored as tenths of cents
    stripeOverageMeterEvent: 'starter_usage',
  },
  'starter-annual': {
    name: 'Starter',
    tier: 'starter' as const,
    includedMinutes: 500,
    overageRateCents: 15,
    stripeOverageMeterEvent: 'starter_annual_usage',
  },
  'pro-monthly': {
    name: 'Pro',
    tier: 'pro' as const,
    includedMinutes: 1000,
    overageRateCents: 10, // $0.01/min
    stripeOverageMeterEvent: 'pro_usage',
  },
  'pro-annual': {
    name: 'Pro',
    tier: 'pro' as const,
    includedMinutes: 1000,
    overageRateCents: 10,
    stripeOverageMeterEvent: 'pro_annual_usage',
  },
} as const;

export type PlanName = keyof typeof PLAN_USAGE_CONFIG;

/**
 * Look up plan usage config from the full plan name stored in sub.plan
 * (e.g. "starter-monthly", "pro-annual").
 */
export const getPlanUsageConfig = (
  planName: string,
): (typeof PLAN_USAGE_CONFIG)[PlanName] | undefined => {
  return PLAN_USAGE_CONFIG[planName as PlanName];
};

export const TRUST_TIERS = {
  new: { overageCapCents: 1000 }, // $10
  established: { overageCapCents: 2500 }, // $25
  trusted: { overageCapCents: 5000 }, // $50
  vip: { overageCapCents: 999999 }, // effectively unlimited
} as const;

export type TrustTier = keyof typeof TRUST_TIERS;

export const USAGE_ALERT_THRESHOLDS = [0.8, 1.0, 1.5] as const;

export const DAILY_CALL_LIMIT_PER_USER = 200;
