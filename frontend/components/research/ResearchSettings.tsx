"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, AlertCircle, Search, FileText, Settings2 } from "lucide-react";
import { CustomFieldSchemaManager } from "./CustomFieldSchemaManager";
import { ResearchTemplateEditor } from "./ResearchTemplateEditor";
import { useTestFirecrawlConnection, useResearchCredits } from "@/hooks/api/useResearch";
import { useEnrichmentVendors, useConnectVendor } from "@/hooks/api/useEnrichment";
import { toast } from "sonner";

export function ResearchSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Research Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure web research capabilities for lead enrichment
        </p>
      </div>

      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connection" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Custom Fields
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection">
          <FirecrawlConnectionSettings />
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Research Templates</CardTitle>
              <CardDescription>
                Create and manage templates for automated web research
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResearchTemplateEditor />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                Define custom fields that can be populated by research results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomFieldSchemaManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FirecrawlConnectionSettings() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: vendorsData, isLoading: connectionLoading } = useEnrichmentVendors();
  const { data: creditsData, isLoading: creditsLoading } = useResearchCredits();
  const testMutation = useTestFirecrawlConnection();
  const connectMutation = useConnectVendor();

  const firecrawlConnection = vendorsData?.data?.find(v => v.provider === "firecrawl");
  const isConnected = !!firecrawlConnection?.isActive;
  const credits = creditsData?.creditsRemaining ?? 0;

  const handleTest = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    testMutation.mutate(apiKey, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Connection successful!");
        } else {
          toast.error(result.message || "Connection failed");
        }
      },
      onError: () => toast.error("Failed to test connection"),
    });
  };

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    connectMutation.mutate(
      { provider: "firecrawl", apiKey },
      {
        onSuccess: () => {
          toast.success("API key saved");
          setApiKey("");
        },
        onError: () => toast.error("Failed to save API key"),
      }
    );
  };

  if (connectionLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Firecrawl Connection
          {isConnected && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              <Check className="h-3 w-3" />
              Connected
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Firecrawl powers web research with AI-driven data extraction
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Credits */}
        {isConnected && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Available Credits</p>
              <p className="text-2xl font-bold text-foreground">
                {creditsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                ) : (
                  credits.toLocaleString()
                )}
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="https://www.firecrawl.dev" target="_blank" rel="noopener noreferrer">
                Buy Credits
              </a>
            </Button>
          </div>
        )}

        {/* API Key Input */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            {isConnected ? "Update API Key" : "API Key"}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? "text" : "password"}
                placeholder={isConnected ? "Enter new API key to update" : "Enter your Firecrawl API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowApiKey(!showApiKey)}
              className="px-3"
            >
              {showApiKey ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{" "}
            <a
              href="https://www.firecrawl.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              firecrawl.dev
            </a>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testMutation.isPending || !apiKey.trim()}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            disabled={connectMutation.isPending || !apiKey.trim()}
          >
            {connectMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {isConnected ? "Update Key" : "Save Key"}
          </Button>
        </div>

        {/* Help */}
        {!isConnected && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Getting Started</p>
              <p className="mt-1">
                1. Sign up at{" "}
                <a
                  href="https://www.firecrawl.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  firecrawl.dev
                </a>
              </p>
              <p>2. Copy your API key from the dashboard</p>
              <p>3. Paste it above and click Save Key</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
