"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/dashboard/Page";
import { PipelineBoard } from "@/components/crm/PipelineBoard";
import { CreateLeadModal } from "@/components/crm/CreateLeadModal";
import { usePipelineStages } from "@/hooks/api/usePipeline";
import { useLeads } from "@/hooks/api/useLeads";
import { useClients } from "@/hooks/api/useClients";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users } from "lucide-react";
import { Logo3DSpinner } from "@/components/ui/Logo3DSpinner";

export default function CRMPage() {
  const router = useRouter();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>();
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();

  const { data: stagesData, isLoading: stagesLoading } = usePipelineStages();
  const { data: clients = [] } = useClients();
  const { data: leadsData, isLoading: leadsLoading } = useLeads({
    inPipeline: true,
    limit: 100,
    clientId: selectedClientId,
    includeClient: true,
  });

  const stages = stagesData?.data || [];
  const leads = leadsData?.data || [];

  const isLoading = stagesLoading || leadsLoading;

  const handleAddLead = (stageId: string) => {
    setSelectedStageId(stageId);
    setCreateModalOpen(true);
  };

  const handleLeadClick = (lead: { id: string }) => {
    router.push(`/dashboard/crm/leads/${lead.id}`);
  };

  return (
    <Page
      title="Pipeline"
      subtitle="Manage your leads through the sales pipeline"
    >
      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Client Filter */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <Select
              value={selectedClientId || "all"}
              onValueChange={(value) => setSelectedClientId(value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      {client.color && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: client.color }}
                        />
                      )}
                      {client.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} in pipeline
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              // Default to first stage when using global Add Lead button
              const firstStage = stages[0];
              setSelectedStageId(firstStage?.id);
              setCreateModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Pipeline Board */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Logo3DSpinner size={80} />
        </div>
      ) : stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-muted-foreground mb-4">No pipeline stages found</p>
          <p className="text-sm text-muted-foreground">
            Pipeline stages will be created automatically when you add your first lead.
          </p>
        </div>
      ) : (
        <PipelineBoard
          stages={stages}
          leads={leads}
          onAddLead={handleAddLead}
          onLeadClick={handleLeadClick}
        />
      )}

      {/* Create Lead Modal */}
      <CreateLeadModal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setSelectedStageId(undefined);
        }}
        pipelineStageId={selectedStageId}
      />
    </Page>
  );
}
