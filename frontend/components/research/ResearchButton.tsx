"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResearchTemplateSelector } from "./ResearchTemplateSelector";
import { useCreateResearchTask, useResearchTemplates } from "@/hooks/api/useResearch";
import { toast } from "sonner";

interface ResearchButtonProps {
  leadId: string;
  leadName?: string;
  variant?: "button" | "dropdown-item";
  onSuccess?: () => void;
}

export function ResearchButton({
  leadId,
  leadName,
  variant = "button",
  onSuccess,
}: ResearchButtonProps) {
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const createTaskMutation = useCreateResearchTask();
  const { data: templatesData, isLoading: templatesLoading } = useResearchTemplates();

  const handleResearch = (templateId?: string) => {
    createTaskMutation.mutate(
      { leadId, templateId },
      {
        onSuccess: () => {
          toast.success("Research task started");
          setShowTemplateSelector(false);
          onSuccess?.();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to start research");
        },
      }
    );
  };

  const templates = templatesData?.data ?? [];
  const hasTemplates = templates.length > 0;

  if (variant === "dropdown-item") {
    return (
      <>
        <DropdownMenuItem
          onClick={() => {
            if (hasTemplates) {
              setShowTemplateSelector(true);
            } else {
              handleResearch();
            }
          }}
          disabled={createTaskMutation.isPending}
        >
          <Search className="w-4 h-4 mr-2" />
          Research Lead
        </DropdownMenuItem>

        <ResearchTemplateSelector
          open={showTemplateSelector}
          onOpenChange={setShowTemplateSelector}
          templates={templates}
          onSelect={handleResearch}
          isLoading={createTaskMutation.isPending}
          leadName={leadName}
        />
      </>
    );
  }

  return (
    <>
      {hasTemplates ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={createTaskMutation.isPending || templatesLoading}
            >
              {createTaskMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Research
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {templates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleResearch(template.id)}
              >
                {template.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResearch()}
          disabled={createTaskMutation.isPending || templatesLoading}
        >
          {createTaskMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          Research
        </Button>
      )}
    </>
  );
}
