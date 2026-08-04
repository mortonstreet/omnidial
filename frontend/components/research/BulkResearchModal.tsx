"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Search, FileText, Globe, AlertCircle } from "lucide-react";
import { useCreateBulkResearchTasks, useResearchTemplates, useResearchCredits } from "@/hooks/api/useResearch";
import { toast } from "sonner";

interface BulkResearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  onSuccess?: () => void;
}

export function BulkResearchModal({
  open,
  onOpenChange,
  leadIds,
  onSuccess,
}: BulkResearchModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const { data: templatesData, isLoading: templatesLoading } = useResearchTemplates();
  const { data: creditsData } = useResearchCredits();
  const createBulkTasksMutation = useCreateBulkResearchTasks();

  const templates = templatesData?.data ?? [];
  const credits = creditsData?.creditsRemaining ?? 0;
  const estimatedCredits = leadIds.length * 5; // Rough estimate

  const handleStartResearch = () => {
    createBulkTasksMutation.mutate(
      {
        leadIds,
        templateId: selectedTemplateId || undefined,
      },
      {
        onSuccess: (result) => {
          const successCount = result.totalCreated ?? 0;
          const failCount = result.errors?.length ?? 0;

          if (successCount > 0) {
            toast.success(`Started research for ${successCount} lead${successCount !== 1 ? "s" : ""}`);
          }
          if (failCount > 0) {
            toast.error(`Failed to start research for ${failCount} lead${failCount !== 1 ? "s" : ""}`);
          }

          onOpenChange(false);
          onSuccess?.();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to start bulk research");
        },
      }
    );
  };

  const hasInsufficientCredits = credits < estimatedCredits;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Research {leadIds.length} Lead{leadIds.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Select a research template to apply to all selected leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Credits Warning */}
          {hasInsufficientCredits && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Low Credits</p>
                <p>
                  You have {credits} credits remaining. This research may require approximately{" "}
                  {estimatedCredits} credits.
                </p>
              </div>
            </div>
          )}

          {/* Template Selection */}
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {/* Quick Research */}
              <button
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedTemplateId === null
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
                onClick={() => setSelectedTemplateId(null)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${selectedTemplateId === null ? "bg-primary/10" : "bg-muted"}`}>
                    <Globe className={`h-4 w-4 ${selectedTemplateId === null ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Quick Web Research</h4>
                    <p className="text-sm text-muted-foreground">General web search</p>
                  </div>
                </div>
              </button>

              {/* Templates */}
              {templates.map((template) => (
                <button
                  key={template.id}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTemplateId === template.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${selectedTemplateId === template.id ? "bg-primary/10" : "bg-muted"}`}>
                      <FileText className={`h-4 w-4 ${selectedTemplateId === template.id ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">{template.name}</h4>
                        {template.isSystemTemplate && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            System
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Leads to research</span>
              <span className="font-medium text-foreground">{leadIds.length}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Estimated credits</span>
              <span className="font-medium text-foreground">~{estimatedCredits}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Available credits</span>
              <span className={`font-medium ${hasInsufficientCredits ? "text-yellow-600" : "text-foreground"}`}>
                {credits}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createBulkTasksMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStartResearch}
            disabled={createBulkTasksMutation.isPending || templatesLoading}
          >
            {createBulkTasksMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Start Research
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
