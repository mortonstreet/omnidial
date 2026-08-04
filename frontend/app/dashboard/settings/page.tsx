"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Page } from "@/components/dashboard/Page";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { OrganizationSettings } from "@/components/settings/OrganizationSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { BillingSettings } from "@/components/settings/BillingSettings";
import { LocalPresenceSettings } from "@/components/local-presence/LocalPresenceSettings";
import { PhoneNumberPoolManager } from "@/components/local-presence/PhoneNumberPoolManager";
import { DataVendorSettings } from "@/components/enrichment/DataVendorSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SlackSettings } from "@/components/settings/SlackSettings";
import { useSession } from "@/lib/auth-client";
import { useListOrganizationMembers } from "@/hooks/api/useOrganization";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { ExperimentalBadge } from "@/components/ui/ExperimentalBadge";
import { PhoneNumberSetup } from "@/components/settings/PhoneNumberSetup";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "OAuth connection failed. Please try again.",
  oauth_callback_failed: "Failed to complete the integration connection. Please try again.",
  state_expired: "The connection request expired. Please try again.",
  access_denied: "Access was denied. Please grant the required permissions and try again.",
};

interface OrgMember {
  userId: string;
  role: string;
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { data: membersData } = useListOrganizationMembers();
  const members: OrgMember[] = membersData?.data?.members || [];

  const integrationConnected = searchParams.get("integration_connected");
  const error = searchParams.get("error");
  const errorDetail = searchParams.get("detail");
  const hasOAuthResult = !!(integrationConnected || error);

  const [activeTab, setActiveTab] = useState(
    hasOAuthResult ? "integrations" : "account"
  );

  useEffect(() => {
    if (integrationConnected) {
      toast.success(`${integrationConnected.replace(/_/g, " ")} connected successfully!`);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      const message = ERROR_MESSAGES[error] || `Integration error: ${error.replace(/_/g, " ")}`;
      toast.error(errorDetail ? `${message} (${errorDetail})` : message);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [integrationConnected, error, errorDetail]);

  const currentUserMember = members.find(
    (m) => m.userId === session?.user?.id
  );
  const isAdmin = currentUserMember?.role === "admin";
  const isOwner = currentUserMember?.role === "owner";
  const canAccessAdminTabs = isAdmin || isOwner;
  const isSuperAdmin = useSuperAdmin();

  return (
    <Page
      title="Settings"
      subtitle="Manage your account and organization settings"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          {canAccessAdminTabs && (
            <>
              <TabsTrigger value="phone-number">Phone Number</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="enrichment">Enrichment</TabsTrigger>
              <TabsTrigger value="local-presence">Local Presence</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </>
          )}
          {isSuperAdmin && (
            <>
              <TabsTrigger value="notifications">Notifications <ExperimentalBadge /></TabsTrigger>
              <TabsTrigger value="slack">Slack <ExperimentalBadge /></TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>

        <TabsContent value="organization">
          <OrganizationSettings isAdmin={canAccessAdminTabs} />
        </TabsContent>

        {canAccessAdminTabs && (
          <>
            <TabsContent value="phone-number">
              <PhoneNumberSetup />
            </TabsContent>

            <TabsContent value="integrations">
              <IntegrationsSettings />
            </TabsContent>

            <TabsContent value="enrichment">
              <DataVendorSettings />
            </TabsContent>

            <TabsContent value="local-presence">
              <div className="space-y-8">
                <PhoneNumberPoolManager />
                <LocalPresenceSettings />
              </div>
            </TabsContent>

            <TabsContent value="billing">
              <BillingSettings />
            </TabsContent>
          </>
        )}

        {isSuperAdmin && (
          <>
            <TabsContent value="notifications">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="slack">
              <SlackSettings />
            </TabsContent>
          </>
        )}
      </Tabs>
    </Page>
  );
}

function LoadingState() {
  return (
    <div className="py-24 text-center text-muted-foreground">Loading...</div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SettingsPageContent />
    </Suspense>
  );
}
