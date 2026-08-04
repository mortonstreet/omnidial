"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Globe, Sparkles } from "lucide-react";
import type { ResearchTemplateResponse } from "@shared/types/src";

interface ResearchTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ResearchTemplateResponse[];
  onSelect: (templateId?: string) => void;
  isLoading?: boolean;
  leadName?: string;
}

export function ResearchTemplateSelector({
  open,
  onOpenChange,
  templates,
  onSelect,
  isLoading,
  leadName,
}: ResearchTemplateSelectorProps) {
  const systemTemplates = templates.filter((t) => t.isSystemTemplate);
  const customTemplates = templates.filter((t) => !t.isSystemTemplate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Research {leadName || "Lead"}
          </DialogTitle>
          <DialogDescription>
            Choose a research template or run a quick web search
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {/* Quick Research Option */}
          <button
            className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
            onClick={() => onSelect(undefined)}
            disabled={isLoading}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground">Quick Web Research</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Run a general web search to find company and contact information
                </p>
              </div>
            </div>
          </button>

          {/* System Templates */}
          {systemTemplates.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Research Templates
              </h4>
              {systemTemplates.map((template) => (
                <button
                  key={template.id}
                  className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  onClick={() => onSelect(template.id)}
                  disabled={isLoading}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground">{template.name}</h4>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      {template.targetUrls && template.targetUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.targetUrls.slice(0, 3).map((url, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                            >
                              {url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                            </span>
                          ))}
                          {template.targetUrls.length > 3 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              +{template.targetUrls.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Custom Templates */}
          {customTemplates.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Custom Templates
              </h4>
              {customTemplates.map((template) => (
                <button
                  key={template.id}
                  className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  onClick={() => onSelect(template.id)}
                  disabled={isLoading}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground">{template.name}</h4>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting research...
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
