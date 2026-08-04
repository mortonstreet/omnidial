"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  useGmailStatus,
  useConnectGmail,
  useDisconnectGmail,
  useTestGmailConnection,
} from "@/hooks/api/useAgents";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface GmailConnectProps {
  agentId: string;
  className?: string;
}

export function GmailConnect({ agentId, className }: GmailConnectProps) {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const { data: status, isLoading, refetch: _refetch, isRefetching: _isRefetching } = useGmailStatus(agentId);
  const connectGmail = useConnectGmail();
  const disconnectGmail = useDisconnectGmail();
  const testConnection = useTestGmailConnection();

  const handleConnect = () => {
    connectGmail.mutate(agentId);
  };

  const handleDisconnect = () => {
    disconnectGmail.mutate(agentId, {
      onSuccess: () => {
        setTestResult(null);
      },
    });
  };

  const handleTest = () => {
    setTestResult(null);
    testConnection.mutate(agentId, {
      onSuccess: (result) => {
        setTestResult(result);
      },
      onError: (error) => {
        setTestResult({
          success: false,
          message: error instanceof Error ? error.message : "Connection test failed",
        });
      },
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gmail Integration
            </CardTitle>
            <CardDescription className="mt-1">
              Send emails through your Gmail account
            </CardDescription>
          </div>
          {status?.connected && (
            <Badge
              variant="outline"
              className={cn(
                status.verified
                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
              )}
            >
              {status.verified ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Verified
                </>
              ) : (
                "Pending Verification"
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.connected ? (
          <>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Connected Account</p>
                <p className="font-medium">{status.email}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testConnection.isPending}
                >
                  {testConnection.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Test
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Gmail?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the Gmail connection from this agent. The agent
                        will no longer be able to send emails via Gmail.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {disconnectGmail.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {testResult && (
              <div
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg text-sm",
                  testResult.success
                    ? "bg-green-500/10 text-green-600"
                    : "bg-red-500/10 text-red-600"
                )}
              >
                {testResult.success ? (
                  <Check className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <X className="h-4 w-4 flex-shrink-0" />
                )}
                {testResult.message}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Gmail account to send emails on behalf of this agent
            </p>
            <Button onClick={handleConnect} disabled={connectGmail.isPending}>
              {connectGmail.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect Gmail
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Gmail integration requires permission to send and read emails. Your credentials
          are encrypted and stored securely.
        </p>
      </CardContent>
    </Card>
  );
}
