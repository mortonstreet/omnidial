'use client';

import { format, parseISO } from 'date-fns';
import Modal from '@/components/ui/modal';
import { useAdminCallDetail } from '@/hooks/api/useAdminLogs';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-mono">{value || '-'}</span>
    </div>
  );
}

function _StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    ringing: 'bg-yellow-100 text-yellow-700',
    initiated: 'bg-gray-100 text-gray-700',
    failed: 'bg-red-100 text-red-700',
    'no-answer': 'bg-orange-100 text-orange-700',
    busy: 'bg-orange-100 text-orange-700',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

export function CallDetailModal({
  callId,
  isOpen,
  onClose,
}: {
  callId: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: call, isLoading } = useAdminCallDetail(callId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Call Detail"
      subtitle={call ? `${call.fromNumber} → ${call.toNumber}` : undefined}
    >
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : !call ? (
        <div className="text-center py-8 text-muted-foreground">Call not found</div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Call Info */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Call Information</h4>
            <div className="bg-muted/50 rounded-lg p-3 space-y-0">
              <InfoRow label="Status" value={call.status} />
              <InfoRow label="Direction" value={call.direction} />
              <InfoRow label="From" value={call.fromNumber} />
              <InfoRow label="To" value={call.toNumber} />
              <InfoRow label="Duration" value={formatDuration(call.duration)} />
              <InfoRow label="Twilio SID" value={call.twilioCallSid} />
              <InfoRow label="Dial SID" value={call.dialCallSid} />
              <InfoRow label="Conference SID" value={call.conferenceSid} />
              <InfoRow label="Organization" value={call.organizationName} />
              <InfoRow label="User" value={call.userName} />
              {(call.leadFirstName || call.leadLastName) && (
                <InfoRow label="Lead" value={`${call.leadFirstName || ''} ${call.leadLastName || ''}`.trim()} />
              )}
              {call.dispositionLabel && (
                <InfoRow label="Disposition" value={call.dispositionLabel} />
              )}
              <InfoRow label="Started" value={call.startedAt ? format(parseISO(call.startedAt), 'MMM d, yyyy h:mm:ss a') : null} />
              <InfoRow label="Answered" value={call.answeredAt ? format(parseISO(call.answeredAt), 'MMM d, yyyy h:mm:ss a') : null} />
              <InfoRow label="Ended" value={call.endedAt ? format(parseISO(call.endedAt), 'MMM d, yyyy h:mm:ss a') : null} />
            </div>
          </div>

          {/* Recording */}
          {call.recordingUrl && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Recording</h4>
              <audio controls className="w-full" src={call.recordingUrl}>
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {/* Transcript */}
          {call.transcript && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">
                Transcript
                <span className="text-xs text-muted-foreground ml-2">
                  ({formatDuration(call.transcript.durationSeconds)} / {call.transcript.language})
                </span>
              </h4>
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                {call.transcript.transcriptText}
              </div>
            </div>
          )}

          {/* Coaching */}
          {call.coaching && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">
                Coaching Score
                <span className={`ml-2 inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                  call.coaching.overallScore >= 80
                    ? 'bg-green-100 text-green-700'
                    : call.coaching.overallScore >= 60
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {call.coaching.overallScore}/100
                </span>
              </h4>
              {call.coaching.strengths.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-green-600 mb-1">Strengths</p>
                  <ul className="text-sm text-muted-foreground space-y-0.5">
                    {call.coaching.strengths.map((s, i) => (
                      <li key={i} className="pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-green-400">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {call.coaching.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-600 mb-1">Areas for Improvement</p>
                  <ul className="text-sm text-muted-foreground space-y-0.5">
                    {call.coaching.improvements.map((s, i) => (
                      <li key={i} className="pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-400">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
