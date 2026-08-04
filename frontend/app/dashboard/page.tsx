'use client';

import { useState, useMemo } from 'react';
import { useActiveOrganization, useSession } from '@/lib/auth-client';
import { useActivityFeed } from '@/hooks/api/useDashboard';
import { useAnalyticsCalls } from '@/hooks/api/useAnalytics';
import { useClients } from '@/hooks/api/useClients';
import { useListOrganizationMembers } from '@/hooks/api/useOrganization';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

// Dashboard components
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { MetricCards } from '@/components/dashboard/MetricCards';
import { MobileQuickStats } from '@/components/dashboard/MobileQuickStats';
import { CallsOverTimeChart } from '@/components/dashboard/CallsOverTimeChart';
import { CallStatusChart } from '@/components/dashboard/CallStatusChart';
import { CallsLogModal } from '@/components/dashboard/CallsLogModal';
import { CallStatusModal } from '@/components/dashboard/CallStatusModal';
import { DashboardFilters, type DateRange } from '@/components/dashboard/DashboardFilters';
import { GoogleSheetsExportModal } from '@/components/sheets/GoogleSheetsExportModal';
import type { DispositionBreakdown } from '@shared/types/src';

export default function DashboardPage() {
  // Filters state
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [clientFilter, setClientFilter] = useState<string | undefined>();
  const [userFilter, setUserFilter] = useState<string | undefined>();
  const [activityFilter, setActivityFilter] = useState<'all' | 'calls' | 'leads' | 'tasks'>('all');
  const [callsLogOpen, setCallsLogOpen] = useState(false);
  const [callStatusModalOpen, setCallStatusModalOpen] = useState(false);
  const [selectedCallStatus, setSelectedCallStatus] = useState<DispositionBreakdown | null>(null);
  const [showSheetsExport, setShowSheetsExport] = useState(false);

  const activeOrganization = useActiveOrganization();
  useSession(); // Keep session for auth context
  const orgId = activeOrganization?.data?.id;

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return {
          startDate: startOfDay(now).toISOString(),
          endDate: endOfDay(now).toISOString(),
        };
      case 'week':
        return {
          startDate: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
          endDate: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        };
      case 'month':
        return {
          startDate: startOfMonth(now).toISOString(),
          endDate: endOfMonth(now).toISOString(),
        };
      case 'all':
        return {
          startDate: new Date('2020-01-01').toISOString(),
          endDate: endOfDay(now).toISOString(),
        };
      case 'custom':
        return {
          startDate: customStart
            ? startOfDay(new Date(customStart)).toISOString()
            : startOfDay(now).toISOString(),
          endDate: customEnd
            ? endOfDay(new Date(customEnd)).toISOString()
            : endOfDay(now).toISOString(),
        };
    }
  }, [dateRange, customStart, customEnd]);

  // Fetch clients for filter
  const { data: clientsData } = useClients();
  const clients = clientsData || [];

  // Fetch org members for filter
  const { data: membersData } = useListOrganizationMembers();
  const members = membersData?.data?.members || [];
  const users = members.map((m: { userId: string; user?: { name: string | null } }) => ({
    id: m.userId,
    name: m.user?.name || null,
  }));

  // Analytics data
  const {
    data: analyticsData,
    isLoading: isLoadingAnalytics,
  } = useAnalyticsCalls({
    organizationId: orgId,
    startDate,
    endDate,
    userId: userFilter,
    clientId: clientFilter,
  });

  const analytics = analyticsData?.data;

  // Activity feed
  const {
    data: activityData,
    isLoading: isLoadingActivity,
    refetch: refetchActivity,
  } = useActivityFeed({
    organizationId: orgId,
    type: activityFilter,
  });

  const handleExport = () => {
    // Export as CSV
    if (!analytics) return;

    const rows = [
      ['Metric', 'Value'],
      ['Total Calls', analytics.metrics.totalCalls.toString()],
      ['Outbound Calls', analytics.metrics.outboundCalls.toString()],
      ['Inbound Calls', analytics.metrics.inboundCalls.toString()],
      ['Connected Calls', analytics.metrics.connectedCalls.toString()],
      ['Connection Rate', `${analytics.metrics.connectionRate}%`],
      ['Total Talk Time (seconds)', analytics.metrics.totalTalkTimeSeconds.toString()],
      ['Avg Call Duration (seconds)', analytics.metrics.avgCallDurationSeconds.toString()],
    ];

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-analytics-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Analytics, activity, and insights at a glance
          </p>
        </div>
        <DashboardFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          customStartDate={customStart}
          customEndDate={customEnd}
          onCustomDateChange={(start, end) => {
            setCustomStart(start);
            setCustomEnd(end);
          }}
          clientId={clientFilter}
          onClientChange={setClientFilter}
          userId={userFilter}
          onUserChange={setUserFilter}
          clients={clients}
          users={users}
          onExport={handleExport}
          onExportToSheets={() => setShowSheetsExport(true)}
        />
      </div>

      {/* Metrics Row - Mobile shows simplified 2x2 grid */}
      <div className="mb-6 sm:hidden">
        <MobileQuickStats
          metrics={analytics?.metrics || {
            totalCalls: 0,
            outboundCalls: 0,
            inboundCalls: 0,
            connectedCalls: 0,
            connectionRate: 0,
            totalTalkTimeSeconds: 0,
            avgCallDurationSeconds: 0,
          }}
          isLoading={isLoadingAnalytics}
        />
      </div>

      {/* Metrics Row - Desktop shows full cards */}
      <div className="mb-6 hidden sm:block">
        <MetricCards
          metrics={analytics?.metrics || {
            totalCalls: 0,
            outboundCalls: 0,
            inboundCalls: 0,
            connectedCalls: 0,
            connectionRate: 0,
            totalTalkTimeSeconds: 0,
            avgCallDurationSeconds: 0,
          }}
          isLoading={isLoadingAnalytics}
        />
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <CallsOverTimeChart
          data={analytics?.callsOverTime || []}
          isLoading={isLoadingAnalytics}
          onViewCalls={() => setCallsLogOpen(true)}
        />
        <CallStatusChart
          data={analytics?.dispositionBreakdown || []}
          isLoading={isLoadingAnalytics}
          onViewStatus={(status) => {
            setSelectedCallStatus(status);
            setCallStatusModalOpen(true);
          }}
        />
      </div>

      {/* Calls Log Modal */}
      <CallsLogModal
        open={callsLogOpen}
        onOpenChange={setCallsLogOpen}
        startDate={startDate}
        endDate={endDate}
        dateRangeLabel={
          dateRange === 'today' ? 'Today'
          : dateRange === 'week' ? 'This Week'
          : dateRange === 'month' ? 'This Month'
          : dateRange === 'all' ? 'All Time'
          : `${customStart} – ${customEnd}`
        }
      />

      {/* Call Status Modal */}
      <CallStatusModal
        open={callStatusModalOpen}
        onOpenChange={setCallStatusModalOpen}
        startDate={startDate}
        endDate={endDate}
        dateRangeLabel={
          dateRange === 'today' ? 'Today'
          : dateRange === 'week' ? 'This Week'
          : dateRange === 'month' ? 'This Month'
          : dateRange === 'all' ? 'All Time'
          : `${customStart} – ${customEnd}`
        }
        selectedStatus={selectedCallStatus}
        allStatuses={analytics?.dispositionBreakdown || []}
      />

      {/* Activity Row */}
      <div className="mb-6">
        <ActivityFeed
          data={activityData?.items}
          isLoading={isLoadingActivity}
          filter={activityFilter}
          onFilterChange={setActivityFilter}
          onRefresh={() => refetchActivity()}
        />
      </div>

      {/* Google Sheets Export Modal */}
      <GoogleSheetsExportModal
        isOpen={showSheetsExport}
        onClose={() => setShowSheetsExport(false)}
        dataType="analytics"
        dateRange={{
          start: startDate.split('T')[0],
          end: endDate.split('T')[0],
        }}
      />
    </div>
  );
}
