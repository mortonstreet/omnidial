"use client";

import { use } from "react";
import { useLead, useUpdateLead, useDeleteLead, useGenerateCompanySummary } from "@/hooks/api/useLeads";
import { usePipelineStages } from "@/hooks/api/usePipeline";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useQuickCall } from "@/hooks/useQuickCall";
import {
  LeadDetailHeader,
  LeadTabSidebar,
  LeadTabContent,
  tabs,
  type TabType,
} from "@/components/leads/detail";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: lead, isLoading: leadLoading, refetch } = useLead(id);
  const { data: stagesData, isLoading: stagesLoading } = usePipelineStages();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const generateSummary = useGenerateCompanySummary();

  const { quickCall } = useQuickCall();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    title: "",
    linkedInUrl: "",
    website: "",
    dealValue: "",
    pipelineStageId: "",
  });

  const stages = stagesData?.data || [];
  const isLoading = leadLoading || stagesLoading;

  const initializeForm = () => {
    if (lead) {
      setFormData({
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        email: lead.email || "",
        phone: lead.phone || "",
        company: lead.company || "",
        title: lead.title || "",
        linkedInUrl: lead.linkedInUrl || "",
        website: lead.website || "",
        dealValue: lead.dealValue?.toString() || "",
        pipelineStageId: lead.pipelineStageId || "",
      });
    }
  };

  const handleEdit = () => {
    initializeForm();
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateLead.mutateAsync({
        id: lead!.id,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        email: formData.email || null,
        phone: formData.phone,
        company: formData.company || null,
        title: formData.title || null,
        linkedInUrl: formData.linkedInUrl || null,
        website: formData.website || null,
        dealValue: formData.dealValue ? parseFloat(formData.dealValue) : null,
        pipelineStageId: formData.pipelineStageId || null,
      });
      setIsEditing(false);
      refetch();
      toast.success("Lead updated");
    } catch {
      toast.error("Failed to update lead");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    try {
      await deleteLead.mutateAsync(lead!.id);
      toast.success("Lead deleted");
      router.push("/dashboard/crm");
    } catch {
      toast.error("Failed to delete lead");
    }
  };

  const handleStageChange = async (stageId: string) => {
    if (!isEditing && lead) {
      try {
        await updateLead.mutateAsync({
          id: lead.id,
          pipelineStageId: stageId || null,
        });
        refetch();
        toast.success("Stage updated");
      } catch {
        toast.error("Failed to update stage");
      }
    } else {
      setFormData((prev) => ({ ...prev, pipelineStageId: stageId }));
    }
  };

  const handleGenerateSummary = async (forceRegenerate = false) => {
    if (!lead) return;
    try {
      await generateSummary.mutateAsync({
        leadId: lead.id,
        forceRegenerate,
      });
      refetch();
      toast.success(forceRegenerate ? "Summary regenerated" : "Summary generated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate summary";
      toast.error(message);
    }
  };

  const handleFormChange = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse pb-20 sm:pb-6">
        {/* Mobile Header Skeleton */}
        <div className="sm:hidden -mx-4 -mt-6 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-muted rounded w-32" />
              <div className="h-4 bg-muted rounded w-24" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-10 bg-muted rounded" />
              <div className="h-10 w-10 bg-muted rounded" />
            </div>
          </div>
        </div>

        {/* Desktop Header Skeleton */}
        <div className="hidden sm:block space-y-3">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-9 bg-muted rounded w-64" />
              <div className="h-4 bg-muted rounded w-48" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 bg-muted rounded w-20" />
              <div className="h-10 bg-muted rounded w-16" />
              <div className="h-10 bg-muted rounded w-10" />
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex gap-6">
          {/* Sidebar Skeleton */}
          <div className="hidden lg:flex flex-col w-48 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-10 bg-muted rounded-lg" />
            ))}
          </div>
          {/* Main Content Skeleton */}
          <div className="flex-1 space-y-6">
            <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
              <div className="flex items-start gap-3 sm:gap-4 mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 sm:h-6 bg-muted rounded w-48" />
                  <div className="h-4 bg-muted rounded w-32" />
                </div>
              </div>
              <div className="flex gap-2 mb-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 bg-muted rounded w-24" />
                ))}
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-muted rounded" />
                    <div className="h-4 bg-muted rounded flex-1 max-w-xs" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Tab Bar Skeleton */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-10 bg-background border-t border-border">
          <div className="flex items-center justify-around py-2 px-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1 py-2 px-3">
                <div className="w-5 h-5 bg-muted rounded" />
                <div className="w-10 h-3 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-6">
        {/* Mobile Header */}
        <div className="sm:hidden -mx-4 -mt-6 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/crm">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="font-semibold text-lg">Lead Not Found</h1>
          </div>
        </div>

        {/* Desktop Header */}
        <h1 className="hidden sm:block font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">
          Lead Not Found
        </h1>

        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <p className="text-muted-foreground mb-4">
            This lead could not be found.
          </p>
          <Link href="/dashboard/crm">
            <Button variant="outline" className="h-11 touch-manipulation">
              <ArrowLeft className="w-4 h-4" />
              Back to Pipeline
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const fullName =
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown Lead";
  const currentStage = stages.find((s) => s.id === lead.pipelineStageId);

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <LeadDetailHeader
        leadId={lead.id}
        fullName={fullName}
        company={lead.company}
        createdAt={lead.createdAt}
        currentStage={currentStage}
        pipelineStageId={lead.pipelineStageId}
        stages={stages}
        email={lead.email}
        isEditing={isEditing}
        isSaving={updateLead.isPending}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onSave={handleSave}
        onDelete={handleDelete}
        onCall={() => quickCall({ leadId: lead.id, leadName: fullName, phone: lead.phone, clientId: lead.client?.id })}
        onStageChange={handleStageChange}
        enrichmentStatus={lead.enrichmentStatus}
        backUrl="/dashboard/crm"
        backLabel="Back to Pipeline"
      />

      {/* Main content: sidebar + tab content */}
      <div className="flex gap-6">
        <LeadTabSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <LeadTabContent
          activeTab={activeTab}
          leadId={id}
          fullName={fullName}
          firstName={lead.firstName}
          lastName={lead.lastName}
          title={lead.title}
          email={lead.email}
          phone={lead.phone}
          company={lead.company}
          linkedInUrl={lead.linkedInUrl}
          website={lead.website}
          dealValue={lead.dealValue}
          customFields={lead.customFields}
          isEditing={isEditing}
          formData={formData}
          onFormChange={handleFormChange}
          onCall={() => quickCall({ leadId: lead.id, leadName: fullName, phone: lead.phone, clientId: lead.client?.id })}
          aiCompanySummary={lead.aiCompanySummary}
          aiCompanyOverview={lead.aiCompanyOverview}
          aiSalesTalkingPoints={lead.aiSalesTalkingPoints as string[] | null}
          aiBusinessContext={lead.aiBusinessContext as Record<string, unknown> | null}
          isGeneratingSummary={generateSummary.isPending}
          onGenerateSummary={handleGenerateSummary}
          enrichmentStatus={lead.enrichmentStatus}
          enrichmentSources={lead.enrichmentSources}
          pipelineStageId={lead.pipelineStageId}
          stages={stages}
          currentStage={currentStage}
          onStageChange={handleStageChange}
        />
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur-sm border-t border-border safe-area-inset-bottom">
        <div className="flex items-center justify-around py-2 px-4" role="tablist" aria-label="Lead details">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg min-w-[60px] transition-colors touch-manipulation ${
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-xs font-medium">{tab.shortLabel || tab.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
