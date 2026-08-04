"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bot, CheckCircle2, Clock, Loader2, TrendingUp, XCircle, AlertCircle, Lock } from "lucide-react";
import { Logo3DSpinner } from "@/components/ui/Logo3DSpinner";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import {
  useAgents,
  useActivateAgent,
  useDeactivateAgent,
  useDeleteAgent,
  useQualificationsStats,
  type Agent,
} from "@/hooks/api/useAgents";
import { AgentCard, CreateAgentDialog, QualificationQueue, JobMonitor, OrchestrationPanel } from "@/components/agents";
import { toast } from "sonner";

type GmailStatus = "connected" | "denied" | "error" | null;

function AgentsPageContent() {
  const isSuperAdmin = useSuperAdmin();
  const searchParams = useSearchParams();
  const [showBanner, setShowBanner] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);

  const gmailStatus = searchParams.get("gmail") as GmailStatus;
  const errorReason = searchParams.get("reason");
  const _connectedAgentId = searchParams.get("agentId");

  // Clear URL params after showing banner
  useEffect(() => {
    if (gmailStatus) {
      const timer = setTimeout(() => {
        window.history.replaceState({}, "", "/dashboard/agents");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [gmailStatus]);

  const getBannerConfig = () => {
    switch (gmailStatus) {
      case "connected":
        return {
          icon: CheckCircle2,
          iconColor: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          title: "Gmail Connected Successfully",
          description: "Your agent can now send emails through Gmail.",
        };
      case "denied":
        return {
          icon: XCircle,
          iconColor: "text-amber-600",
          bgColor: "bg-amber-50 border-amber-200",
          title: "Gmail Connection Cancelled",
          description: "You cancelled the Gmail authorization. Click 'Connect Gmail' on the agent to try again.",
        };
      case "error":
        return {
          icon: AlertCircle,
          iconColor: "text-red-600",
          bgColor: "bg-red-50 border-red-200",
          title: "Gmail Connection Failed",
          description: errorReason
            ? `Unable to connect Gmail: ${errorReason.replace(/_/g, " ")}`
            : "Something went wrong while connecting Gmail. Please try again.",
        };
      default:
        return null;
    }
  };

  const bannerConfig = getBannerConfig();

  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: stats, isLoading: statsLoading } = useQualificationsStats();

  const activateAgent = useActivateAgent();
  const deactivateAgent = useDeactivateAgent();
  const deleteAgent = useDeleteAgent();

  const handleActivate = async (id: string) => {
    try {
      await activateAgent.mutateAsync(id);
      toast.success("Agent activated");
    } catch {
      toast.error("Failed to activate agent");
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateAgent.mutateAsync(id);
      toast.success("Agent deactivated");
    } catch {
      toast.error("Failed to deactivate agent");
    }
  };

  const handleDeleteClick = (id: string) => {
    setAgentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;
    try {
      await deleteAgent.mutateAsync(agentToDelete);
      toast.success("Agent deleted");
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
      if (selectedAgent?.id === agentToDelete) {
        setSelectedAgent(null);
      }
    } catch {
      toast.error("Failed to delete agent");
    }
  };

  const handleEdit = (agent: Agent) => {
    setSelectedAgent(agent);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Feature Not Available</h2>
        <p className="text-muted-foreground max-w-md">
          AI Agents is an experimental feature that is not yet available for general use. Contact your administrator for more information.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gmail OAuth Status Banner */}
      {bannerConfig && showBanner && (
        <div
          className={`${bannerConfig.bgColor} border rounded-lg p-4 flex items-start gap-3`}
        >
          <bannerConfig.icon
            className={`w-5 h-5 ${bannerConfig.iconColor} flex-shrink-0 mt-0.5`}
          />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">
              {bannerConfig.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {bannerConfig.description}
            </p>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground">
            Configure and monitor your AI SDR agents
          </p>
        </div>
        <CreateAgentDialog />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agentsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                agents?.length || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {agents?.filter((a) => a.status === "active").length || 0} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Intent</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                stats?.highIntent || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">qualified leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                stats?.pendingReview || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Qualified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                stats?.total || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="orchestration">Orchestration</TabsTrigger>
          <TabsTrigger value="qualifications">
            Review Queue
            {stats?.pendingReview ? (
              <Badge variant="secondary" className="ml-2">
                {stats.pendingReview}
              </Badge>
            ) : null}
          </TabsTrigger>
          {selectedAgent && (
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          {agentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Logo3DSpinner size={80} />
            </div>
          ) : agents?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No agents yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first AI agent to start qualifying leads automatically
                </p>
                <CreateAgentDialog />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents?.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onActivate={handleActivate}
                  onDeactivate={handleDeactivate}
                  onDelete={handleDeleteClick}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orchestration">
          <OrchestrationPanel />
        </TabsContent>

        <TabsContent value="qualifications">
          <QualificationQueue />
        </TabsContent>

        {selectedAgent && (
          <TabsContent value="jobs">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedAgent.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Orchestration jobs for this agent
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelectedAgent(null)}>
                  View All Agents
                </Button>
              </div>
              <JobMonitor agentId={selectedAgent.id} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be
              undone. All associated workflows and configurations will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAgent.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="py-24 text-center text-muted-foreground">Loading...</div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AgentsPageContent />
    </Suspense>
  );
}
