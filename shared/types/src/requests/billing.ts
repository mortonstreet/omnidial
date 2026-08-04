export interface GetUsageDashboardRequest {
  organizationId: string;
}

export interface UsageCycleData {
  id: string;
  periodStart: string;
  periodEnd: string;
  includedMinutes: number;
  usedMinutes: number;
  overageMinutes: number;
  overageAmountCents: number;
  overageRateCents: number;
  isCurrent: boolean;
  finalized: boolean;
}

export interface GetUsageDashboardResponse {
  cycle: UsageCycleData | null;
  percentUsed: number;
  daysRemaining: number;
  projectedMinutes: number;
  projectedOverage: boolean;
  accountStatus: string;
  overageCapCents: number;
  overageCapHit: boolean;
}

export interface GetUsageHistoryRequest {
  organizationId: string;
}

export interface GetUsageHistoryResponse {
  cycles: UsageCycleData[];
}

export interface AcknowledgeOverageCapRequest {
  organizationId: string;
  additionalCapCents?: number;
}

export interface AcknowledgeOverageCapResponse {
  newCapCents: number;
  overageCapHit: boolean;
}

export type CallGuardReason =
  | 'ALLOWED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_CANCELED'
  | 'OVERAGE_CAP_HIT'
  | 'DAILY_LIMIT_REACHED'
  | 'NO_ACTIVE_SUBSCRIPTION'
  | 'BILLING_GUARD_UNAVAILABLE';

export interface CallGuardResult {
  allowed: boolean;
  reason: CallGuardReason;
  minutesUsed?: number;
  minutesIncluded?: number;
  overageAmountCents?: number;
  overageCapCents?: number;
  retryable?: boolean;
  httpStatus?: number;
  correlationId?: string;
}
