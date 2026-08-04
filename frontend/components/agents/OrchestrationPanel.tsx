"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  useAgentDefinitions,
  useInvokeOrchestrator,
  useInvokeAgentByType,
  useExecutions,
  usePendingApprovals,
  useOrchestrationTools,
} from "@/hooks/api/useOrchestration";
import type { AgentDefinitionType } from "@shared/types/src/requests/leadAgent";

export function OrchestrationPanel() {
  const [prompt, setPrompt] = useState("");
  const [selectedAgentType, setSelectedAgentType] = useState<AgentDefinitionType | "orchestrator">("orchestrator");
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const { data: definitions, isLoading: defsLoading } = useAgentDefinitions();
  const { data: executions, isLoading: execsLoading } = useExecutions({ limit: 10 });
  const { data: approvals } = usePendingApprovals({ limit: 10 });
  const { data: tools } = useOrchestrationTools();

  const invokeOrchestrator = useInvokeOrchestrator();
  const invokeByType = useInvokeAgentByType(selectedAgentType as AgentDefinitionType);

  const handleInvoke = async () => {
    if (!prompt.trim()) return;

    try {
      let result;
      if (selectedAgentType === "orchestrator") {
        result = await invokeOrchestrator.mutateAsync({ prompt });
      } else {
        result = await invokeByType.mutateAsync({ prompt });
      }
      setLastResponse(result.response || "No response");
      setPrompt("");
    } catch (error) {
      setLastResponse(`Error: ${(error as Error).message}`);
    }
  };

  const isInvoking = invokeOrchestrator.isPending || invokeByType.isPending;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "running":
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case "awaiting_approval":
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Awaiting Approval</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Invoke Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Invoke Agent
          </CardTitle>
          <CardDescription>
            Send a prompt to the orchestrator or a specialized agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select
              value={selectedAgentType}
              onValueChange={(v) => setSelectedAgentType(v as AgentDefinitionType | "orchestrator")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orchestrator">Orchestrator</SelectItem>
                <SelectItem value="research">Research Agent</SelectItem>
                <SelectItem value="email">Email Agent</SelectItem>
                <SelectItem value="sms">SMS Agent</SelectItem>
                <SelectItem value="qualify">Qualification Agent</SelectItem>
                <SelectItem value="analytics">Analytics Agent</SelectItem>
                <SelectItem value="campaign">Campaign Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder="Enter your prompt... (e.g., 'Research Acme Corp and tell me about their business')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end">
            <Button onClick={handleInvoke} disabled={isInvoking || !prompt.trim()}>
              {isInvoking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send
            </Button>
          </div>

          {lastResponse && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Response:</h4>
              <p className="text-sm whitespace-pre-wrap">{lastResponse}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Definitions, Executions, Tools */}
      <Tabs defaultValue="definitions">
        <TabsList>
          <TabsTrigger value="definitions">
            Agent Definitions
            {definitions?.definitions && (
              <Badge variant="secondary" className="ml-2">{definitions.definitions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="executions">
            Executions
            {executions?.executions && (
              <Badge variant="secondary" className="ml-2">{executions.executions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approvals">
            Pending Approvals
            {approvals?.approvals && approvals.approvals.length > 0 && (
              <Badge className="ml-2 bg-yellow-500">{approvals.approvals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tools">
            Tools
            {tools?.tools && (
              <Badge variant="secondary" className="ml-2">{tools.tools.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="definitions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Agent Definitions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {defsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {definitions?.definitions?.map((def) => (
                    <div
                      key={def.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{def.name}</h4>
                        <p className="text-sm text-muted-foreground">{def.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{def.type}</Badge>
                        <Badge variant="secondary">{def.model}</Badge>
                        {def.isActive ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              {execsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : executions?.executions?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No executions yet</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {executions?.executions?.map((exec) => (
                      <div
                        key={exec.id}
                        className="p-3 border rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono">{exec.id.slice(0, 8)}...</span>
                          {getStatusBadge(exec.status)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {exec.inputPrompt}
                        </p>
                        {exec.outputResponse && (
                          <p className="text-sm bg-muted p-2 rounded line-clamp-3">
                            {exec.outputResponse}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {approvals?.approvals?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pending approvals</p>
              ) : (
                <div className="space-y-3">
                  {approvals?.approvals?.map((approval) => (
                    <div
                      key={approval.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Badge>{approval.approvalType}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(approval.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{approval.actionSummary}</p>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive">
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Available Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="grid gap-2">
                  {tools?.tools?.map((tool) => (
                    <div
                      key={tool.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium font-mono text-sm">{tool.name}</h4>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tool.category}</Badge>
                        {tool.requiresApproval && (
                          <Badge className="bg-yellow-500">Requires Approval</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
