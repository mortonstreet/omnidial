'use client';

import { useState } from 'react';
import { Page } from '@/components/dashboard/Page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useActiveOrganization } from '@/lib/auth-client';
import {
  useOrganizationSubscription,
  useCreatePortalSession,
} from '@/hooks/api/useStripe';
import { useSubscriptionInfo } from '@/hooks/api/useSubscription';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { toast } from 'sonner';
import {
  Sparkles,
  Phone,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export default function BillingSettingsPage() {
  const { data: activeOrganization } = useActiveOrganization();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Stripe hooks
  const createPortalSession = useCreatePortalSession();
  const { data: subscription, isLoading: subscriptionLoading } =
    useOrganizationSubscription(activeOrganization?.id);
  const { data: subscriptionInfo } = useSubscriptionInfo();

  const tier = subscriptionInfo?.tier;
  const isTrialing = subscriptionInfo?.isTrialing;

  const handleManageBilling = async () => {
    if (!activeOrganization) {
      toast.error('No active organization');
      return;
    }

    createPortalSession.mutate(
      { organizationId: activeOrganization.id },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSuccess: (data: any) => {
          if (data?.error) {
            toast.error(data.error.message || 'Failed to open billing portal');
          } else if (data?.data?.url) {
            window.location.href = data.data.url;
          }
        },
        onError: () => {
          toast.error('Failed to open billing portal');
        },
      }
    );
  };

  const [now] = useState(() => Date.now());
  const trialDaysLeft = subscription?.trialEnd
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEnd).getTime() - now) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <Page title="Billing" subtitle="Manage your subscription and payment methods">
      <div className="space-y-6">
        {/* Trial Banner */}
        {isTrialing && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">
                Your trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-amber-700">
                You have full Pro access during your trial period.
              </p>
            </div>
          </div>
        )}

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptionLoading ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            ) : subscription ? (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-foreground">
                        {tier
                          ? tier.charAt(0).toUpperCase() + tier.slice(1)
                          : subscription.plan.charAt(0).toUpperCase() +
                            subscription.plan.slice(1)}{' '}
                        Plan
                      </p>
                      {isTrialing && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                          Trial
                        </span>
                      )}
                      {subscription.status === 'active' && !isTrialing && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {subscription.seats
                        ? `${subscription.seats} seat${subscription.seats !== 1 ? 's' : ''}`
                        : 'Per-seat billing'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={createPortalSession.isPending}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Billing
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-muted-foreground/20 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          No Active Plan
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Choose a plan to get started
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => setShowUpgradeModal(true)}>
                      Choose Plan
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Card (if Starter) */}
        {tier === 'starter' && !isTrialing && (
          <Card>
            <CardHeader>
              <CardTitle>Upgrade to Pro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Unlock AI-powered features to supercharge your team&apos;s performance.
                </p>
                <ul className="space-y-2">
                  {[
                    'AI Sales Coaching',
                    'Call Intelligence',
                    'Advanced analytics',
                    'Priority support',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={() => setShowUpgradeModal(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phone Numbers */}
        <Card>
          <CardHeader>
            <CardTitle>Phone Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {tier === 'pro' ? 'Dedicated numbers' : 'Shared pool number'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tier === 'pro'
                      ? 'Dedicated phone numbers for your team'
                      : 'Using shared phone number pool'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Portal Link */}
        {subscription && (
          <div className="text-center">
            <button
              onClick={handleManageBilling}
              disabled={createPortalSession.isPending}
              className="text-sm text-primary hover:underline"
            >
              Open Stripe Billing Portal to manage payment methods, view invoices,
              and cancel subscription
            </button>
          </div>
        )}
      </div>

      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
    </Page>
  );
}
