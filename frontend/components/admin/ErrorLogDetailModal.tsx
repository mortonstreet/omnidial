'use client';

import { useState } from 'react';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  User,
  Building2,
  Phone,
  Target,
  Users,
  CheckCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  Globe,
} from 'lucide-react';
import { useAdminErrorLogDetail, useUpdateErrorLogStatus } from '@/hooks/api/useErrorLogs';
import { toast } from 'sonner';

interface ErrorLogDetailModalProps {
  errorLogId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// Parse HTTP status code from error code (e.g., "API_500" -> 500)
function parseHttpStatus(code: string): number | null {
  const match = code.match(/API_(\d{3})/);
  return match ? parseInt(match[1], 10) : null;
}

function getHttpStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return statusTexts[status] || (status >= 500 ? 'Server Error' : status >= 400 ? 'Client Error' : 'Error');
}

function HttpStatusDisplay({ code }: { code: string }) {
  const status = parseHttpStatus(code);
  if (!status) return null;

  const getStatusColor = (s: number) => {
    if (s >= 500) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
    if (s >= 400) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusColor(status)}`}>
      <Globe className="h-4 w-4" />
      <div>
        <span className="font-mono font-bold">{status}</span>
        <span className="ml-2 text-sm">{getHttpStatusText(status)}</span>
      </div>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <AlertOctagon className="h-5 w-5 text-red-700" />;
    case 'error':
      return <AlertOctagon className="h-5 w-5 text-red-500" />;
    case 'warning':
    default:
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    open: 'bg-red-100 text-red-700',
    acknowledged: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[status as keyof typeof colors] || colors.open}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function ErrorLogDetailModal({ errorLogId, isOpen, onClose }: ErrorLogDetailModalProps) {
  const { data: errorLog, isLoading } = useAdminErrorLogDetail(errorLogId);
  const updateStatusMutation = useUpdateErrorLogStatus();
  const [resolutionNote, setResolutionNote] = useState('');
  const [showStackTrace, setShowStackTrace] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const handleUpdateStatus = (status: 'acknowledged' | 'resolved') => {
    if (!errorLogId) return;

    updateStatusMutation.mutate(
      { id: errorLogId, status, resolutionNote: status === 'resolved' ? resolutionNote : undefined },
      {
        onSuccess: () => {
          toast.success(`Error log ${status}`);
          if (status === 'resolved') {
            setResolutionNote('');
          }
        },
        onError: (error: Error) => {
          toast.error(error.message || `Failed to ${status} error log`);
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Error Details"
      subtitle={errorLog ? `${errorLog.code} - ${errorLog.product}` : undefined}
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded animate-pulse" />
          <div className="h-20 bg-muted rounded animate-pulse" />
          <div className="h-6 bg-muted rounded animate-pulse" />
        </div>
      ) : errorLog ? (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Header with severity and status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SeverityIcon severity={errorLog.severity} />
              <div>
                <p className="font-mono text-sm font-medium text-foreground">{errorLog.code}</p>
                <p className="text-xs text-muted-foreground capitalize">{errorLog.severity}</p>
              </div>
            </div>
            <StatusBadge status={errorLog.status} />
          </div>

          {/* HTTP Status (if applicable) */}
          {parseHttpStatus(errorLog.code) && (
            <HttpStatusDisplay code={errorLog.code} />
          )}

          {/* Message */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-foreground">{errorLog.message}</p>
            {errorLog.description && (
              <p className="text-sm text-muted-foreground mt-2">{errorLog.description}</p>
            )}
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Occurred At</p>
                <p className="text-foreground">{format(parseISO(errorLog.occurredAt), 'MMM d, yyyy h:mm:ss a')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Product / Category</p>
                <p className="text-foreground">{errorLog.product} / {errorLog.category}</p>
              </div>
            </div>

            {errorLog.organizationName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Organization</p>
                  <p className="text-foreground">{errorLog.organizationName}</p>
                </div>
              </div>
            )}

            {(errorLog.userName || errorLog.userEmail) && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">User</p>
                  <p className="text-foreground">{errorLog.userName || errorLog.userEmail}</p>
                </div>
              </div>
            )}

            {errorLog.campaignName && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Campaign</p>
                  <p className="text-foreground">{errorLog.campaignName}</p>
                </div>
              </div>
            )}

            {errorLog.twilioCallSid && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Twilio Call SID</p>
                  <p className="text-foreground font-mono text-xs">{errorLog.twilioCallSid}</p>
                </div>
              </div>
            )}

            {errorLog.source && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-foreground">{errorLog.source}</p>
                </div>
              </div>
            )}

            {errorLog.requestId && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Request ID</p>
                  <p className="text-foreground font-mono text-xs">{errorLog.requestId}</p>
                </div>
              </div>
            )}
          </div>

          {/* Stack trace (collapsible) */}
          {errorLog.stackTrace && (
            <div className="border border-border rounded-lg">
              <button
                onClick={() => setShowStackTrace(!showStackTrace)}
                className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                <span>Stack Trace</span>
                {showStackTrace ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showStackTrace && (
                <div className="p-3 pt-0">
                  <pre className="text-xs text-muted-foreground bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                    {errorLog.stackTrace}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Metadata (collapsible) */}
          {errorLog.metadata && Object.keys(errorLog.metadata).length > 0 && (
            <div className="border border-border rounded-lg">
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                <span>Metadata</span>
                {showMetadata ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showMetadata && (
                <div className="p-3 pt-0">
                  <pre className="text-xs text-muted-foreground bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(errorLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Resolution info */}
          {errorLog.status === 'resolved' && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Resolved</span>
              </div>
              {errorLog.resolvedByName && (
                <p className="text-sm text-muted-foreground">
                  By: {errorLog.resolvedByName}
                </p>
              )}
              {errorLog.resolvedAt && (
                <p className="text-sm text-muted-foreground">
                  At: {format(parseISO(errorLog.resolvedAt), 'MMM d, yyyy h:mm a')}
                </p>
              )}
              {errorLog.resolutionNote && (
                <p className="text-sm text-foreground mt-2">{errorLog.resolutionNote}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {errorLog.status !== 'resolved' && (
            <div className="border-t border-border pt-4 space-y-4">
              {errorLog.status === 'open' && (
                <Button
                  variant="outline"
                  onClick={() => handleUpdateStatus('acknowledged')}
                  disabled={updateStatusMutation.isPending}
                  className="w-full"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Acknowledge
                </Button>
              )}

              <div className="space-y-2">
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Resolution note (optional)"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground outline-none transition focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] resize-none placeholder:text-muted-foreground"
                  rows={2}
                />
                <Button
                  onClick={() => handleUpdateStatus('resolved')}
                  disabled={updateStatusMutation.isPending}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Resolved
                </Button>
              </div>
            </div>
          )}

          {/* Close button */}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Error log not found
        </div>
      )}
    </Modal>
  );
}
