"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { LeadCallHistory } from "@/components/leads/LeadCallHistory";
import { LeadCoachingHistory } from "@/components/leads/LeadCoachingHistory";
import { LeadIntelligenceHistory } from "@/components/intelligence";
import { CompanySummaryCard } from "@/components/leads/CompanySummaryCard";
import { NotesList } from "@/components/crm/NotesList";
import { TaskList } from "@/components/crm/TaskList";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { ContactCard } from "./ContactCard";
import { LeadEnrichmentPanel } from "@/components/enrichment/LeadEnrichmentPanel";
import { LeadContactInfoList } from "@/components/enrichment/LeadContactInfoList";
import type { TabType } from "./LeadTabSidebar";

interface LeadTabContentProps {
  activeTab: TabType;
  leadId: string;
  // Contact card props
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string;
  company: string | null;
  linkedInUrl: string | null;
  website: string | null;
  dealValue: string | null;
  customFields: unknown;
  isEditing: boolean;
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    title: string;
    linkedInUrl: string;
    website: string;
    dealValue: string;
    pipelineStageId: string;
  };
  onFormChange: (data: Partial<LeadTabContentProps["formData"]>) => void;
  onCall: () => void;
  // Intel tab props
  aiCompanySummary: string | null;
  aiCompanyOverview: string | null;
  aiSalesTalkingPoints: string[] | null;
  aiBusinessContext: Record<string, unknown> | null;
  isGeneratingSummary: boolean;
  onGenerateSummary: (forceRegenerate?: boolean) => void;
  // Enrichment
  enrichmentStatus?: string | null;
  enrichmentSources?: string[] | null;
  // Pipeline (mobile)
  pipelineStageId: string | null;
  stages: { id: string; label: string; color: string }[];
  currentStage: { id: string; label: string; color: string } | undefined;
  onStageChange: (stageId: string) => void;
}

export function LeadTabContent({
  activeTab,
  leadId,
  fullName,
  firstName,
  lastName,
  title,
  email,
  phone,
  company,
  linkedInUrl,
  website,
  dealValue,
  customFields,
  isEditing,
  formData,
  onFormChange,
  onCall,
  aiCompanySummary,
  aiCompanyOverview,
  aiSalesTalkingPoints,
  aiBusinessContext,
  isGeneratingSummary,
  onGenerateSummary,
  enrichmentStatus,
  enrichmentSources,
  pipelineStageId,
  stages,
  currentStage,
  onStageChange,
}: LeadTabContentProps) {
  return (
    <div
      className="flex-1 min-w-0"
      role="tabpanel"
      id={`tabpanel-${activeTab}`}
      aria-label={activeTab}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <ContactCard
            fullName={fullName}
            firstName={firstName}
            lastName={lastName}
            title={title}
            email={email}
            phone={phone}
            company={company}
            linkedInUrl={linkedInUrl}
            website={website}
            dealValue={dealValue}
            customFields={customFields}
            isEditing={isEditing}
            formData={formData}
            onFormChange={onFormChange}
            onCall={onCall}
          />

          <LeadEnrichmentPanel
            leadId={leadId}
            enrichmentStatus={
              enrichmentStatus === "enriched"
                ? "complete"
                : enrichmentStatus === "failed"
                  ? "failed"
                  : "none"
            }
            enrichmentSources={enrichmentSources || []}
          />
          <LeadContactInfoList leadId={leadId} />

          {/* Mobile: Pipeline Stage */}
          <div className="lg:hidden p-4 rounded-xl border border-border bg-card">
            <h3 id="mobile-stage-label" className="text-sm font-medium text-foreground mb-3">
              Pipeline Stage
            </h3>
            <select
              value={isEditing ? formData.pipelineStageId : pipelineStageId || ""}
              onChange={(e) => onStageChange(e.target.value)}
              aria-labelledby="mobile-stage-label"
              className="w-full p-3 rounded-md border border-input bg-background text-sm h-12 touch-manipulation"
            >
              <option value="">No stage</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
            {currentStage && !isEditing && (
              <div className="mt-3 flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentStage.color }}
                />
                <span className="text-sm text-foreground">
                  {currentStage.label}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
          <h3 className="text-lg font-semibold text-foreground mb-4">Activity Timeline</h3>
          <ActivityTimeline leadId={leadId} />
        </div>
      )}

      {activeTab === "notes" && (
        <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
          <NotesList leadId={leadId} />
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
          <TaskList leadId={leadId} />
        </div>
      )}

      {activeTab === "calls" && (
        <LeadCallHistory
          leadId={leadId}
          leadName={fullName}
          limit={50}
          showTitle={true}
        />
      )}

      {activeTab === "coaching" && (
        <LeadCoachingHistory leadId={leadId} />
      )}

      {activeTab === "intel" && (
        <div className="space-y-6">
          <LeadIntelligenceHistory leadId={leadId} />

          {/* AI Company Summary (moved here from right sidebar) */}
          {company && (
            <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Company Summary
                </h3>
                {aiCompanySummary && aiCompanySummary !== "NO_INFO_AVAILABLE" && (
                  <button
                    onClick={() => onGenerateSummary(true)}
                    disabled={isGeneratingSummary}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    aria-label="Regenerate AI summary"
                  >
                    {isGeneratingSummary ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
              <CompanySummaryCard
                summary={aiCompanySummary}
                companyName={company}
                isGenerating={isGeneratingSummary}
                onGenerate={() => onGenerateSummary(false)}
                onRegenerate={() => onGenerateSummary(true)}
                structuredData={
                  aiCompanyOverview
                    ? {
                        overview: aiCompanyOverview,
                        talkingPoints: aiSalesTalkingPoints,
                        businessContext: aiBusinessContext,
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
