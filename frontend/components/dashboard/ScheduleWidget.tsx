'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Monitor, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';

export interface ScheduleEvent {
  id: string;
  type: 'callback' | 'meeting' | 'demo';
  title: string;
  leadId?: string;
  leadName?: string;
  startTime: string;
  endTime?: string;
  notes?: string;
}

interface ScheduleWidgetProps {
  events?: ScheduleEvent[];
  isLoading: boolean;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  onEventClick?: (event: ScheduleEvent) => void;
  onQuickDial?: (event: ScheduleEvent) => void;
}

function getEventIcon(type: ScheduleEvent['type']) {
  switch (type) {
    case 'callback':
      return <Phone className="h-4 w-4" />;
    case 'demo':
      return <Monitor className="h-4 w-4" />;
    case 'meeting':
      return <CalendarIcon className="h-4 w-4" />;
    default:
      return <CalendarIcon className="h-4 w-4" />;
  }
}

function getEventBgColor(type: ScheduleEvent['type']) {
  switch (type) {
    case 'callback':
      return 'bg-blue-500/10 border-blue-500/20 text-blue-600';
    case 'demo':
      return 'bg-purple-500/10 border-purple-500/20 text-purple-600';
    case 'meeting':
      return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600';
    default:
      return 'bg-muted border-border text-muted-foreground';
  }
}

export function ScheduleWidget({
  events = [],
  isLoading,
  selectedDate = new Date(),
  onDateChange,
  onEventClick,
  onQuickDial,
}: ScheduleWidgetProps) {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const handlePrevDay = () => {
    onDateChange?.(subDays(selectedDate, 1));
  };

  const handleNextDay = () => {
    onDateChange?.(addDays(selectedDate, 1));
  };

  const handleToday = () => {
    onDateChange?.(new Date());
  };

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Group events by hour for timeline display
  const eventsByHour = sortedEvents.reduce((acc, event) => {
    const hour = format(parseISO(event.startTime), 'h:mm a');
    if (!acc[hour]) {
      acc[hour] = [];
    }
    acc[hour].push(event);
    return acc;
  }, {} as Record<string, ScheduleEvent[]>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Schedule</CardTitle>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-md border border-border p-0.5">
            <button
              onClick={() => setViewMode('day')}
              className={`px-2 py-1 text-xs font-medium rounded transition ${
                viewMode === 'day'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-2 py-1 text-xs font-medium rounded transition ${
                viewMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Week
            </button>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevDay}
              className="p-1 rounded hover:bg-muted transition"
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleToday}
              className={`px-2 py-1 text-xs font-medium rounded transition ${
                isToday(selectedDate)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {format(selectedDate, 'MMM d')}
            </button>
            <button
              onClick={handleNextDay}
              className="p-1 rounded hover:bg-muted transition"
              title="Next day"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No events scheduled</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(eventsByHour).map(([time, hourEvents]) => (
              <div key={time} className="flex gap-3">
                <div className="w-16 flex-shrink-0 pt-2">
                  <span className="text-xs font-medium text-muted-foreground">{time}</span>
                </div>
                <div className="flex-1 space-y-2">
                  {hourEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className={`
                        flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition hover:shadow-sm
                        ${getEventBgColor(event.type)}
                      `}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background/50">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        {event.leadName && (
                          <p className="text-xs opacity-70 truncate">{event.leadName}</p>
                        )}
                        {event.notes && (
                          <p className="text-xs opacity-50 truncate mt-0.5">{event.notes}</p>
                        )}
                      </div>
                      {event.type === 'callback' && onQuickDial && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickDial(event);
                          }}
                          className="p-1.5 rounded-full bg-background/50 hover:bg-background transition"
                          title="Quick dial"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
