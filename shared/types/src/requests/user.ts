import { DBAccount, DBUser } from '@shared/db/src/types';

export type AccountResponse = DBAccount;
export type UserResponse = DBUser;

export interface CompleteOnboardingRequest {
  name?: string;
  role: string;
  industry: string;
}

export interface OnboardingStatusResponse {
  onboardingComplete: boolean;
}
