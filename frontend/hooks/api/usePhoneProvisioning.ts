import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  PhoneProvisioningStatusResponse,
  SearchAvailableNumbersResponse,
  ProvisionPhoneNumberResponse,
  VerifyCallerIdResponse,
  CheckCallerIdVerificationResponse,
  AdminPhoneProvisioningResponse,
} from "@shared/types/src";

export function usePhoneProvisioningStatus() {
  const { data: org } = useActiveOrganization();
  return useQuery({
    queryKey: QUERY_KEYS.phoneProvisioningStatus(org?.id),
    queryFn: async () => {
      return get<PhoneProvisioningStatusResponse>(ENDPOINTS.PHONE_SETUP.STATUS);
    },
    enabled: !!org?.id,
  });
}

export function useSearchAvailableNumbers(areaCode: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.availableNumbers(areaCode),
    queryFn: async () => {
      return get<SearchAvailableNumbersResponse>(
        ENDPOINTS.PHONE_SETUP.SEARCH(areaCode)
      );
    },
    enabled: enabled && areaCode.length === 3,
  });
}

export function useSetupInfrastructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return post<PhoneProvisioningStatusResponse>(ENDPOINTS.PHONE_SETUP.SETUP);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["phone-setup"],
      });
    },
  });
}

export function useProvisionPhoneNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (phoneNumber: string) => {
      return post<ProvisionPhoneNumberResponse>(ENDPOINTS.PHONE_SETUP.PROVISION, {
        phoneNumber,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["phone-setup"],
      });
      queryClient.invalidateQueries({
        queryKey: ["dialer"],
      });
    },
  });
}

export function useProvisionQuickNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return post<PhoneProvisioningStatusResponse>(
        ENDPOINTS.PHONE_SETUP.PROVISION_QUICK
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["phone-setup"],
      });
      queryClient.invalidateQueries({
        queryKey: ["dialer"],
      });
    },
  });
}

export function useVerifyCallerId() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return post<VerifyCallerIdResponse>(ENDPOINTS.PHONE_SETUP.VERIFY);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["phone-setup"],
      });
    },
  });
}

export function useCallerIdVerificationStatus() {
  const { data: org } = useActiveOrganization();
  return useQuery({
    queryKey: QUERY_KEYS.callerIdVerificationStatus(org?.id),
    queryFn: async () => {
      return get<CheckCallerIdVerificationResponse>(
        ENDPOINTS.PHONE_SETUP.VERIFY_STATUS
      );
    },
    enabled: !!org?.id,
  });
}

export function useAdminPhoneProvisioning() {
  return useQuery({
    queryKey: QUERY_KEYS.adminPhoneProvisioning(),
    queryFn: async () => {
      return get<AdminPhoneProvisioningResponse>(
        ENDPOINTS.ADMIN.PHONE_PROVISIONING
      );
    },
  });
}

export function useAdminProvisionOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      return post(ENDPOINTS.ADMIN.PROVISION_ORG(orgId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPhoneProvisioning(),
      });
    },
  });
}

export function useAdminMarkMainAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      return post(ENDPOINTS.ADMIN.MARK_MAIN_ACCOUNT(orgId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPhoneProvisioning(),
      });
    },
  });
}

export function useAdminReleaseNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      return post(ENDPOINTS.ADMIN.RELEASE_NUMBER(orgId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPhoneProvisioning(),
      });
    },
  });
}
