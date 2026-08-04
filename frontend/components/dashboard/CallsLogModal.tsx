'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AudioPlayer } from '@/components/ui/audio-player';
import { useCalls } from '@/hooks/api/useCalls';
import { useSession } from '@/lib/auth-client';
import { useListOrganizationMembers } from '@/hooks/api/useOrganization';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CallResponse } from '@shared/types/src';

interface Member {
  id: string;
  userId: string;
  role: string;
}

interface CallsLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  completed: { bg: 'bg-green-500/10', text: 'text-green-500' },
  'in-progress': { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  ringing: { bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
  initiated: { bg: 'bg-gray-500/10', text: 'text-gray-500' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-500' },
  missed: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
};

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function CallRow({ call }: { call: CallResponse }) {
  const leadName = [call.leadFirstName, call.leadLastName].filter(Boolean).join(' ') || 'Unknown';
  const statusStyle = STATUS_STYLES[call.status] || STATUS_STYLES.initiated;
  const hasRecording = !!call.recordingUrl;

  return (
    <div className="flex flex-col gap-3 p-4 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Direction icon */}
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
              call.direction === 'inbound' ? 'bg-green-500/10' : 'bg-blue-500/10'
            )}
          >
            {call.direction === 'inbound' ? (
              <PhoneIncoming className="w-4 h-4 text-green-500" />
            ) : (
              <PhoneOutgoing className="w-4 h-4 text-blue-500" />
            )}
          </div>

          {/* Lead info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{leadName}</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium uppercase',
                  statusStyle.bg,
                  statusStyle.text
                )}
              >
                {call.status}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {call.direction === 'inbound' ? call.fromNumber : call.toNumber}
            </div>
          </div>
        </div>

        {/* Timestamp and duration */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDuration(call.duration)}</span>
          </div>
          <div className="text-right">
            <div>{format(parseISO(call.startedAt), 'MMM d, yyyy')}</div>
            <div>{format(parseISO(call.startedAt), 'h:mm a')}</div>
          </div>
        </div>
      </div>

      {/* Details row */}
      <div className="flex items-center justify-between gap-4 pl-11">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {call.userName && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{call.userName}</span>
            </div>
          )}
          {call.dispositionLabel && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: `${call.dispositionColor || '#6B7280'}20`,
                color: call.dispositionColor || '#6B7280',
              }}
            >
              {call.dispositionLabel}
            </span>
          )}
        </div>

        {/* Audio player */}
        {hasRecording && (
          <AudioPlayer
            callId={call.id}
            leadName={leadName}
            callDate={call.startedAt}
            compact
          />
        )}
      </div>
    </div>
  );
}

export function CallsLogModal({
  open,
  onOpenChange,
  startDate,
  endDate,
  dateRangeLabel,
}: CallsLogModalProps) {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data: session } = useSession();

  // Get organization members to check user role
  const { data: membersData } = useListOrganizationMembers();
  const members = (membersData?.data?.members || []) as Member[];

  // Check if current user is admin or owner
  const currentUserMember = members.find((m) => m.userId === session?.user?.id);
  const isAdminOrOwner = currentUserMember?.role === 'admin' || currentUserMember?.role === 'owner';

  // For members, only show their own calls
  const userIdFilter = isAdminOrOwner ? undefined : session?.user?.id;

  const { data, isLoading, isFetching } = useCalls(
    {
      startDate,
      endDate,
      page,
      limit,
      userId: userIdFilter,
    },
    open
  );

  const calls = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Call Log
          </DialogTitle>
          <DialogDescription>
            {total.toLocaleString()} {isAdminOrOwner ? 'calls' : 'of your calls'} for {dateRangeLabel}
          </DialogDescription>
        </DialogHeader>

        {/* Call list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Phone className="w-10 h-10 mb-3 opacity-50" />
              <p>No calls found for this period</p>
            </div>
          ) : (
            <div className={cn(isFetching && 'opacity-50 pointer-events-none transition-opacity')}>
              {calls.map((call) => (
                <CallRow key={call.id} call={call} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="flex items-center justify-center w-8 h-8 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isFetching}
                className="flex items-center justify-center w-8 h-8 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
