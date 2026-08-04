import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/lib/api';
import { ENDPOINTS } from '@/lib/config';
import type { ActivityItem } from '@/components/dashboard/ActivityFeed';
import type { ScheduleEvent } from '@/components/dashboard/ScheduleWidget';
import type { TaskItem } from '@/components/dashboard/TaskWidget';

const DASHBOARD_QUERY_KEYS = {
  activity: (orgId?: string, type?: string) => ['activity', orgId, type] as const,
  schedule: (orgId?: string, startDate?: string, endDate?: string) =>
    ['schedule', orgId, startDate, endDate] as const,
  dashboardTasks: (userId?: string) => ['dashboard-tasks', userId] as const,
};

interface UseActivityFeedOptions {
  organizationId: string | undefined;
  type?: 'all' | 'calls' | 'leads' | 'tasks';
  limit?: number;
  enabled?: boolean;
}

interface ActivityFeedResponse {
  items: ActivityItem[];
  nextCursor?: string;
}

export function useActivityFeed({
  organizationId,
  type = 'all',
  limit = 20,
  enabled = true,
}: UseActivityFeedOptions) {
  return useQuery<ActivityFeedResponse>({
    queryKey: DASHBOARD_QUERY_KEYS.activity(organizationId, type),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (type !== 'all') params.append('type', type);
        params.append('limit', limit.toString());
        const queryString = params.toString();
        const url = `${ENDPOINTS.ACTIVITY.LIST(organizationId!)}${queryString ? `?${queryString}` : ''}`;
        return await get<ActivityFeedResponse>(url);
      } catch (error) {
        console.error('Failed to fetch activity feed:', error);
        return { items: [] };
      }
    },
    enabled: enabled && !!organizationId,
    // Return empty items if the endpoint doesn't exist yet
    placeholderData: { items: [] },
  });
}

interface UseScheduleOptions {
  organizationId: string | undefined;
  startDate?: string;
  endDate?: string;
  userId?: string;
  enabled?: boolean;
}

interface ScheduleResponse {
  events: ScheduleEvent[];
}

export function useSchedule({
  organizationId,
  startDate,
  endDate,
  userId,
  enabled = true,
}: UseScheduleOptions) {
  return useQuery<ScheduleResponse>({
    queryKey: DASHBOARD_QUERY_KEYS.schedule(organizationId, startDate, endDate),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (userId) params.append('userId', userId);
        const queryString = params.toString();
        const url = `${ENDPOINTS.SCHEDULE.LIST(organizationId!)}${queryString ? `?${queryString}` : ''}`;
        return await get<ScheduleResponse>(url);
      } catch (error) {
        console.error('Failed to fetch schedule:', error);
        return { events: [] };
      }
    },
    enabled: enabled && !!organizationId,
    // Return empty events if the endpoint doesn't exist yet
    placeholderData: { events: [] },
  });
}

interface UseDashboardTasksOptions {
  userId: string | undefined;
  enabled?: boolean;
}

interface TasksApiResponse {
  data: Array<{
    id: string;
    title: string;
    leadId: string;
    dueAt: string | null;
    completedAt: string | null;
    lead?: {
      firstName?: string;
      lastName?: string;
      company?: string;
    };
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TasksResponse {
  tasks: TaskItem[];
  total: number;
}

export function useDashboardTasks({
  userId,
  enabled = true,
}: UseDashboardTasksOptions) {
  // Get tasks due within the next week (including overdue)
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  return useQuery<TasksResponse>({
    queryKey: DASHBOARD_QUERY_KEYS.dashboardTasks(userId),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (userId) params.append('userId', userId);
        params.append('completed', 'false');
        params.append('dueTo', weekFromNow.toISOString());
        const queryString = params.toString();
        const url = `${ENDPOINTS.TASKS.LIST}?${queryString}`;
        const apiResponse = await get<TasksApiResponse>(url);

        // Transform API response to match expected format
        const tasks: TaskItem[] = (apiResponse?.data || []).map((task) => ({
          id: task.id,
          title: task.title,
          leadId: task.leadId,
          leadName: task.lead
            ? [task.lead.firstName, task.lead.lastName].filter(Boolean).join(' ') || task.lead.company
            : undefined,
          dueAt: task.dueAt,
          completedAt: task.completedAt,
        }));

        return { tasks, total: apiResponse?.total || 0 };
      } catch (error) {
        console.error('Failed to fetch dashboard tasks:', error);
        return { tasks: [], total: 0 };
      }
    },
    enabled: enabled && !!userId,
    placeholderData: { tasks: [], total: 0 },
  });
}

export function useCompleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      return await post(`${ENDPOINTS.TASKS.COMPLETE(taskId)}`, {});
    },
    onSuccess: () => {
      // Invalidate all task queries
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
