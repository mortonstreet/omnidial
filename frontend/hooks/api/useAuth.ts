import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/lib/api';
import {
  signIn,
  signOut,
} from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import type { CompleteOnboardingRequest, OnboardingStatusResponse } from '@shared/types/src/requests/user';

// Types
interface MagicLinkParams {
  email: string;
  callbackURL?: string;
  newUserCallbackURL?: string;
  errorCallbackURL?: string;
}

// Sign in with social provider (Google)
export function useSignInSocial() {
  return useMutation({
    mutationFn: async (params: { provider: 'google'; callbackURL: string }) => {
      return await signIn.social(params);
    },
  });
}

// Sign out
export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      return await signOut();
    }
  });
}

// Send magic link - passwordless login/signup
export function useMagicLink() {
  return useMutation({
    mutationFn: async (params: MagicLinkParams) => {
      return await signIn.magicLink(params);
    },
  });
}

// Complete onboarding questionnaire
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: CompleteOnboardingRequest) => {
      return await post<{ success: boolean }>(ENDPOINTS.USER.ONBOARDING, params);
    },
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEYS.onboardingStatus(), { onboardingComplete: true });
    },
  });
}

// Check onboarding status
export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.onboardingStatus(),
    queryFn: async () => {
      return await get<OnboardingStatusResponse>(ENDPOINTS.USER.ONBOARDING_STATUS);
    },
    enabled,
  });
}
