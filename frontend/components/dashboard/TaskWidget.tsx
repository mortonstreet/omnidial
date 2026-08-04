'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Calendar, CheckCircle2, ExternalLink } from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';
import Link from 'next/link';

export interface TaskItem {
  id: string;
  title: string;
  leadId: string;
  leadName?: string;
  dueAt: string | null;
  completedAt: string | null;
}

interface TaskWidgetProps {
  tasks?: TaskItem[];
  isLoading: boolean;
  onComplete?: (taskId: string) => void;
}

function TaskRow({
  task,
  isOverdue,
  onComplete,
}: {
  task: TaskItem;
  isOverdue: boolean;
  onComplete?: (taskId: string) => void;
}) {
  return (
    <div
      className={`
        flex items-center gap-3 rounded-lg border p-3 transition
        ${isOverdue ? 'border-destructive/50 bg-destructive/5' : 'border-border hover:bg-muted/50'}
      `}
    >
      <button
        onClick={() => onComplete?.(task.id)}
        className="flex h-5 w-5 items-center justify-center rounded border border-border hover:border-primary hover:bg-primary/10 transition"
        title="Mark complete"
      >
        {task.completedAt ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : null}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
        {task.leadName && (
          <p className="text-xs text-muted-foreground truncate">{task.leadName}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {task.dueAt && (
          <p className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {isOverdue
              ? 'Overdue'
              : isToday(parseISO(task.dueAt))
              ? format(parseISO(task.dueAt), 'h:mm a')
              : format(parseISO(task.dueAt), 'MMM d')}
          </p>
        )}
      </div>
    </div>
  );
}

export function TaskWidget({ tasks = [], isLoading, onComplete }: TaskWidgetProps) {
  const incompleteTasks = tasks.filter((t) => !t.completedAt);

  const overdueTasks = incompleteTasks.filter(
    (t) => t.dueAt && isPast(parseISO(t.dueAt)) && !isToday(parseISO(t.dueAt))
  );

  const todayTasks = incompleteTasks.filter(
    (t) => t.dueAt && isToday(parseISO(t.dueAt))
  );

  const upcomingTasks = incompleteTasks.filter(
    (t) => t.dueAt && !isPast(parseISO(t.dueAt)) && !isToday(parseISO(t.dueAt))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Today&apos;s Tasks</CardTitle>
        <Link
          href="/dashboard/crm"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
        >
          View All
          <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="max-h-[350px] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : incompleteTasks.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            <p>All caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overdue Section */}
            {overdueTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-semibold text-destructive uppercase tracking-wide">
                    Overdue
                  </span>
                </div>
                <div className="space-y-2">
                  {overdueTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isOverdue={true}
                      onComplete={onComplete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Today Section */}
            {todayTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Today
                  </span>
                </div>
                <div className="space-y-2">
                  {todayTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isOverdue={false}
                      onComplete={onComplete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Summary */}
            {upcomingTasks.length > 0 && (
              <p className="text-sm text-muted-foreground pt-2 border-t border-border">
                {upcomingTasks.length} upcoming task{upcomingTasks.length !== 1 ? 's' : ''} this week
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
