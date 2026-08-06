"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getToken,
  useUser,
} from "@clerk/nextjs";
import { get, post } from "@/lib/api";

type LocalOrganization = {
  id: string;
  clerkOrganizationId?: string | null;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt?: string;
  role?: string;
};

type LocalSessionPayload = {
  user: Record<string, unknown> & {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    role?: string | null;
  };
  session: Record<string, unknown> & {
    activeOrganizationId?: string | null;
  };
  activeOrganization: LocalOrganization | null;
  organizations: LocalOrganization[];
};

type ApiResult<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

type BillingSubscription = {
  id: string;
  plan: string;
  status: string;
  seats?: number | null;
  trialEnd?: string | null;
  periodEnd?: string | null;
};

const CLERK_SESSION_QUERY_KEY = ["auth", "clerk-session"] as const;

function useLocalSessionQuery(enabled: boolean) {
  return useQuery({
    queryKey: CLERK_SESSION_QUERY_KEY,
    queryFn: async () =>
      get<{ data: LocalSessionPayload }>("/auth/clerk/session"),
    enabled,
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useSession() {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const sessionQuery = useLocalSessionQuery(Boolean(isLoaded && isSignedIn));

  const fallbackUser = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
        name: clerkUser.fullName ?? null,
        image: clerkUser.imageUrl ?? null,
        role:
          typeof clerkUser.publicMetadata?.omnidialRole === "string"
            ? clerkUser.publicMetadata.omnidialRole
            : null,
      }
    : null;

  const data =
    sessionQuery.data?.data ??
    (isSignedIn && fallbackUser
      ? {
          user: fallbackUser,
          session: {},
          activeOrganization: null,
          organizations: [],
        }
      : null);

  const isPending =
    !isLoaded ||
    (Boolean(isSignedIn) && sessionQuery.isLoading && !sessionQuery.data);

  return {
    data,
    isPending,
    isLoading: isPending,
    error: sessionQuery.error,
    refetch: sessionQuery.refetch,
  };
}

export function useActiveOrganization() {
  const session = useSession();

  return {
    data: session.data?.activeOrganization ?? null,
    isPending: session.isPending,
    isLoading: session.isLoading,
    error: session.error,
    refetch: session.refetch,
  };
}

export async function signOut() {
  if (typeof window === "undefined") return { data: null };
  await (window as Window & { Clerk?: { signOut: () => Promise<void> } })
    .Clerk?.signOut();
  return { data: null };
}

export const signIn = {
  magicLink: async (_params?: {
    email?: string;
    callbackURL?: string;
    newUserCallbackURL?: string;
    errorCallbackURL?: string;
  }) => ({
    error: {
      message:
        "Clerk authentication is active. Use the Clerk sign-in form instead.",
    },
  }),
  social: async (params: { callbackURL?: string }) => {
    if (typeof window !== "undefined") {
      const redirect = params.callbackURL
        ? `?redirect=${encodeURIComponent(params.callbackURL)}`
        : "";
      window.location.href = `/login${redirect}`;
    }
    return { data: null };
  },
};

export const signUp = {};
export const sendVerificationEmail = async () => ({ data: null });

export const organization = {
  list: async () => get<{ data: LocalOrganization[] }>("/auth/organization/list"),
  checkSlug: async ({ slug }: { slug: string }) =>
    get<{ data: { status: boolean } }>(
      `/auth/organization/check-slug?slug=${encodeURIComponent(slug)}`,
    ),
  create: async (params: {
    name: string;
    slug: string;
    keepCurrentActiveOrganization?: boolean;
  }): Promise<ApiResult<LocalOrganization>> =>
    post<ApiResult<LocalOrganization>>("/auth/organization/create", params),
  setActive: async (params: {
    organizationId?: string;
    organizationSlug?: string;
  }): Promise<ApiResult<LocalOrganization>> =>
    post<ApiResult<LocalOrganization>>("/auth/organization/set-active", params),
  listMembers: async () =>
    get<{
      data: {
        members: Array<{
          id: string;
          userId: string;
          role: string;
          user?: {
            id: string;
            name: string | null;
            email: string;
            image?: string | null;
          };
        }>;
      };
    }>("/auth/organization/members"),
  listInvitations: async () =>
    get<{
      data: Array<{
        id: string;
        email: string;
        role: string;
        status: string;
        expiresAt: Date;
        createdAt?: Date;
      }>;
    }>("/auth/organization/invitations"),
  inviteMember: async (params: {
    email: string;
    role: "member" | "admin" | "owner";
    organizationId?: string;
    resend?: boolean;
  }) => post<ApiResult<unknown>>("/auth/organization/invite-member", params),
  cancelInvitation: async (params: { invitationId: string }) =>
    post<ApiResult<unknown>>("/auth/organization/cancel-invitation", params),
  removeMember: async (params: {
    memberIdOrEmail: string;
    organizationId?: string;
  }) => post<ApiResult<unknown>>("/auth/organization/remove-member", params),
  acceptInvitation: async (
    _params?: { invitationId?: string },
  ): Promise<ApiResult<{ member?: { organizationId?: string } }>> => ({
    error: {
      message:
        "This invitation was issued through the legacy auth flow. Ask an admin to resend it from the team settings page.",
    },
  }),
};

export const subscription = {
  upgrade: async (_params?: {
    plan?: string;
    referenceId?: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<ApiResult<{ url?: string }>> => ({
    error: {
      message:
        "Billing checkout needs the Clerk/Stripe billing path configured before it can open.",
    },
  }),
  list: async (params?: { query?: { referenceId?: string } }) => {
    const referenceId = params?.query?.referenceId;
    if (!referenceId) return { data: [] };
    const result = await get<{
      subscription: BillingSubscription | null;
    }>(`/organization/${referenceId}/subscription`);
    return { data: result.subscription ? [result.subscription] : [] };
  },
  billingPortal: async (_params?: {
    referenceId?: string;
    returnUrl?: string;
  }): Promise<ApiResult<{ url?: string }>> => ({
    error: {
      message:
        "Billing portal needs the Clerk/Stripe billing path configured before it can open.",
    },
  }),
};

export const admin = {
  impersonateUser: async (_params?: { userId?: string }) => ({
    error: {
      message: "Use Clerk impersonation from the Clerk dashboard.",
    },
  }),
  stopImpersonating: async () => ({ data: null }),
};

export const getClerkSessionToken = () => getToken();
