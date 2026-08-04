export type PlanTier = 'starter' | 'pro';
export type BillingInterval = 'month' | 'year';

export interface StripePlan {
  name: string;
  priceId: string;
  overagePriceId: string;
  tier: PlanTier;
  interval: BillingInterval;
  pricePerSeat: number;
}

export const STRIPE_PLANS: StripePlan[] = [
  {
    name: 'starter-monthly',
    priceId: 'price_1SxiVKHynOztZXpi1AcMhKTb',
    overagePriceId: 'price_1Sy1BuHynOztZXpikMcJRdYe',
    tier: 'starter',
    interval: 'month',
    pricePerSeat: 15,
  },
  {
    name: 'starter-annual',
    priceId: 'price_1SxiVwHynOztZXpi4KXDXzw5',
    overagePriceId: 'price_1Sy1DXHynOztZXpiQQ52Gqn2',
    tier: 'starter',
    interval: 'year',
    pricePerSeat: 150,
  },
  {
    name: 'pro-monthly',
    priceId: 'price_1SxiVZHynOztZXpifr8z07Os',
    overagePriceId: 'price_1Sy1CQHynOztZXpiBUJ2LT3n',
    tier: 'pro',
    interval: 'month',
    pricePerSeat: 25,
  },
  {
    name: 'pro-annual',
    priceId: 'price_1SxiWDHynOztZXpihEHdpKq7',
    overagePriceId: 'price_1Sy1D0HynOztZXpiwdd5GFsv',
    tier: 'pro',
    interval: 'year',
    pricePerSeat: 250,
  },
];

export const getPlan = (
  tier: PlanTier,
  interval: BillingInterval,
): StripePlan | undefined => {
  return STRIPE_PLANS.find((p) => p.tier === tier && p.interval === interval);
};

export const getTierFromPlanName = (planName: string): PlanTier => {
  const plan = STRIPE_PLANS.find((p) => p.name === planName);
  return plan?.tier ?? 'starter';
};

export const getIntervalFromPlanName = (
  planName: string,
): BillingInterval | undefined => {
  const plan = STRIPE_PLANS.find((p) => p.name === planName);
  return plan?.interval;
};

export const getPlanByName = (
  planName: string,
): StripePlan | undefined => {
  return STRIPE_PLANS.find((p) => p.name === planName);
};

export const getOveragePriceId = (
  planName: string,
): string | undefined => {
  return STRIPE_PLANS.find((p) => p.name === planName)?.overagePriceId;
};

export type AppFeature =
  | 'dashboard'
  | 'crm'
  | 'campaigns'
  | 'leads'
  | 'lists'
  | 'dialer'
  | 'sales-floor'
  | 'settings'
  | 'coaching';

export const PLAN_FEATURES: Record<PlanTier, AppFeature[]> = {
  starter: [
    'dashboard',
    'crm',
    'campaigns',
    'leads',
    'lists',
    'dialer',
    'sales-floor',
    'settings',
  ],
  pro: [
    'dashboard',
    'crm',
    'campaigns',
    'leads',
    'lists',
    'dialer',
    'sales-floor',
    'settings',
    'coaching',
  ],
};

export const PRO_ONLY_FEATURES: AppFeature[] = ['coaching'];

export const planHasFeature = (
  tier: PlanTier,
  feature: AppFeature,
): boolean => {
  return PLAN_FEATURES[tier]?.includes(feature) ?? false;
};

export const TRIAL_DURATION_DAYS = 14;
