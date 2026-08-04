"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Trash2,
  PhoneOutgoing,
  MoreVertical,
  Mail,
  ChevronDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddToCampaignDropdown } from "@/components/leads/AddToCampaignDropdown";
import { EnrichButton } from "@/components/enrichment/EnrichButton";

interface PipelineStage {
  id: string;
  label: string;
  color: string;
}

interface LeadDetailHeaderProps {
  leadId: string;
  fullName: string;
  company: string | null;
  createdAt: Date;
  currentStage: PipelineStage | undefined;
  pipelineStageId: string | null;
  stages: PipelineStage[];
  email: string | null;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onCall: () => void;
  onStageChange: (stageId: string) => void;
  enrichmentStatus?: string | null;
  backUrl?: string;
  backLabel?: string;
}

export function LeadDetailHeader({
  leadId,
  fullName,
  company,
  createdAt,
  currentStage,
  pipelineStageId,
  stages,
  email,
  isEditing,
  isSaving,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onCall,
  enrichmentStatus,
  onStageChange,
  backUrl = "/dashboard/leads",
  backLabel = "Back to Leads",
}: LeadDetailHeaderProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      {/* Mobile Sticky Header */}
      <div className="sm:hidden sticky top-0 z-10 -mx-4 -mt-6 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={backUrl} className="flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-semibold text-lg truncate">
                {isEditing ? "Edit Lead" : fullName}
              </h1>
              {company && !isEditing && (
                <p className="text-sm text-muted-foreground truncate">{company}</p>
              )}
              {!isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border border-border bg-muted/50 hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring mt-0.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: currentStage?.color || "#6B7280" }}
                      />
                      <span>{currentStage?.label || "No stage"}</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => onStageChange("")}>
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[#6B7280]" />
                        <span>No stage</span>
                        {!pipelineStageId && (
                          <Check className="w-4 h-4 ml-auto text-primary" />
                        )}
                      </div>
                    </DropdownMenuItem>
                    {stages.map((stage) => (
                      <DropdownMenuItem
                        key={stage.id}
                        onClick={() => onStageChange(stage.id)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span>{stage.label}</span>
                          {pipelineStageId === stage.id && (
                            <Check className="w-4 h-4 ml-auto text-primary" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={onCancel} className="h-10 w-10">
                  <X className="w-5 h-5" />
                </Button>
                <Button size="icon" onClick={onSave} disabled={isSaving} className="h-10 w-10">
                  <Save className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  className="h-10 w-10"
                  aria-label="Call lead"
                  onClick={onCall}
                >
                  <PhoneOutgoing className="w-5 h-5" aria-hidden="true" />
                </Button>
                {email && (
                  <a href={`mailto:${email}`}>
                    <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Email lead">
                      <Mail className="w-5 h-5" aria-hidden="true" />
                    </Button>
                  </a>
                )}
                <EnrichButton leadId={leadId} enrichmentStatus={enrichmentStatus} size="icon" variant="outline" />
                <AddToCampaignDropdown leadIds={[leadId]} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Lead
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Lead
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden sm:block space-y-1">
        <Link href={backUrl}>
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Button>
        </Link>

        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">
              {isEditing ? "Edit Lead" : fullName}
            </h1>
            {!isEditing && (
              <div className="flex items-center gap-3 text-sm">
                {company && (
                  <span className="text-muted-foreground">{company}</span>
                )}
                {/* Pipeline stage dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium border border-border bg-muted/50 hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: currentStage?.color || "#6B7280" }}
                      />
                      <span>{currentStage?.label || "No stage"}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem
                      onClick={() => onStageChange("")}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[#6B7280]" />
                        <span>No stage</span>
                        {!pipelineStageId && (
                          <Check className="w-4 h-4 ml-auto text-primary" />
                        )}
                      </div>
                    </DropdownMenuItem>
                    {stages.map((stage) => (
                      <DropdownMenuItem
                        key={stage.id}
                        onClick={() => onStageChange(stage.id)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span>{stage.label}</span>
                          {pipelineStageId === stage.id && (
                            <Check className="w-4 h-4 ml-auto text-primary" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-xs text-muted-foreground">
                  Created {formattedDate}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={onCancel}>
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
                <Button onClick={onSave} disabled={isSaving}>
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onCall}>
                  <PhoneOutgoing className="w-4 h-4" />
                  Call
                </Button>
                <EnrichButton leadId={leadId} enrichmentStatus={enrichmentStatus} variant="outline" />
                <AddToCampaignDropdown leadIds={[leadId]} />
                <Button variant="outline" onClick={onEdit}>
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
