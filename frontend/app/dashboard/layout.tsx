// app/dashboard/layout.tsx
"use client";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useOrganizations } from "@/hooks/api/useOrganization";
import { useOnboardingStatus } from "@/hooks/api/useAuth";
import CreateOrganizationModal from "@/components/organization/CreateOrganizationModal";
import { themeConfig } from "@/theme.config";
import {
  SidebarLayout,
  TopnavWithSidebarLayout,
  SidebarWithTopbarLayout,
} from "@/components/layouts";
import { DialerProvider } from "@/components/providers/DialerProvider";
import { GlobalIncomingCallBanner, FloatingDialerWidget } from "@/components/dialer";
import { Building2 } from "lucide-react";
import { getAuthErrorMessage, normalizeAuthErrorCode } from "@/lib/auth-errors";

// Get the app URL for redirects
const getAppUrl = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.includes("localhost")) {
    return appUrl;
  }
  return "";
};

const layoutMap = {
  sidebar: SidebarLayout,
  topnavWithSidebar: TopnavWithSidebarLayout,
  sidebarWithTopbar: SidebarWithTopbarLayout,
} as const;

const getAuthQueryFromLocation = () => {
  if (typeof window === "undefined") {
    return {
      correlationId: null,
      authErrorCode: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    correlationId: params.get("correlationId"),
    authErrorCode: normalizeAuthErrorCode(params.get("authError") ?? params.get("error")),
  };
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-background">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [manualShowCreateModal, setManualShowCreateModal] = useState(false);
  const [modalAllowClose, setModalAllowClose] = useState(false);
  const { isLoading: isLoadingOrgs } = useOrganizations();
  const { data: organizations } = useOrganizations();
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useOnboardingStatus(!!session);
  const { correlationId, authErrorCode } = getAuthQueryFromLocation();

  // Check if user is super admin
  const isSuperAdmin = session?.user?.role === "superadmin";

  // Derive whether to show modal from data - only for super admins
  const hasNoOrgs = !isPending && !isLoadingOrgs && session && organizations?.data?.length === 0;
  const showCreateModal = isSuperAdmin && (hasNoOrgs || manualShowCreateModal);

  useEffect(() => {
    if (!authErrorCode) return;
    toast.error(getAuthErrorMessage(authErrorCode, correlationId));
  }, [authErrorCode, correlationId]);

  useEffect(() => {
    if (!isPending && !session) {
      toast.error("Please login to access the dashboard");
      const loginPath = (() => {
        const loginUrl = new URL("/login", window.location.origin);
        if (authErrorCode) {
          loginUrl.searchParams.set("authError", authErrorCode);
        }
        if (correlationId) {
          loginUrl.searchParams.set("correlationId", correlationId);
        }
        return `${loginUrl.pathname}${loginUrl.search}`;
      })();
      const appUrl = getAppUrl();
      if (appUrl) {
        window.location.href = `${appUrl}${loginPath}`;
      } else {
        router.push(loginPath);
      }
    }
  }, [session, isPending, router, authErrorCode, correlationId]);

  // Redirect to onboarding if not complete (superadmins skip onboarding)
  useEffect(() => {
    if (
      !isLoadingOnboarding &&
      onboardingStatus &&
      !onboardingStatus.onboardingComplete &&
      !isSuperAdmin
    ) {
      const appUrl = getAppUrl();
      if (appUrl) {
        window.location.href = `${appUrl}/onboarding`;
      } else {
        router.push("/onboarding");
      }
    }
  }, [onboardingStatus, isLoadingOnboarding, router, isSuperAdmin]);

  if (isPending) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    const appUrl = getAppUrl();
    if (appUrl) {
      window.location.href = `${appUrl}/login`;
    } else {
      router.push("/login");
    }
  };

  const handleCreateSuccess = () => {
    setManualShowCreateModal(false);
  };

  const handleOpenCreateOrg = () => {
    if (!isSuperAdmin) {
      toast.error("Only administrators can create organizations");
      return;
    }
    setModalAllowClose(true);
    setManualShowCreateModal(true);
  };

  // Select layout from config
  const LayoutComponent = layoutMap[themeConfig.layout] ?? layoutMap.sidebar;

  // If user has no orgs and is not a super admin, show "No Organization Access" message
  if (hasNoOrgs && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-2xl border border-border p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">No Organization Access</h1>
            <p className="text-muted-foreground">
              You are not a member of any organization. Please contact your administrator to be added to a workspace.
            </p>
          </div>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Logged in as <span className="font-medium text-foreground">{session?.user?.email}</span>
            </p>
            <button
              onClick={handleLogout}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DialerProvider>
      <GlobalIncomingCallBanner />
      <FloatingDialerWidget />
      <LayoutComponent
        onLogout={handleLogout}
        onOpenCreateOrg={handleOpenCreateOrg}
        canCreateOrg={isSuperAdmin}
      >
        {children}
      </LayoutComponent>

      <CreateOrganizationModal
        isOpen={showCreateModal}
        onClose={hasNoOrgs ? () => {} : () => setManualShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        allowClose={modalAllowClose || !hasNoOrgs}
      />
    </DialerProvider>
  );
}
