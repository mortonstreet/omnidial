"use client";

import { useState } from "react";
import { Plus, Search, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { CsvUploader } from "@/components/campaigns/CsvUploader";
import {
  useCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
} from "@/hooks/api/useCampaigns";
import { useClients, useCreateClient } from "@/hooks/api/useClients";
import { useLists } from "@/hooks/api/useLists";
import { toast } from "sonner";

type CreateStep = "info" | "leads";

export default function CampaignsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>("info");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newClientName, setNewClientName] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  const { data, isLoading } = useCampaigns({
    search: search || undefined,
    status:
      statusFilter !== "all"
        ? (statusFilter as "active" | "inactive")
        : undefined,
    clientId: clientFilter !== "all" ? clientFilter : undefined,
  });

  const { data: clients } = useClients();
  const { data: lists } = useLists();

  const createMutation = useCreateCampaign();
  const deleteMutation = useDeleteCampaign();
  const createClientMutation = useCreateClient();

  const resetCreateDialog = () => {
    setCreateStep("info");
    setNewCampaignName("");
    setSelectedClientId("");
    setSelectedListId("");
    setNewClientName("");
    setIsCreatingClient(false);
    setCreatedCampaignId(null);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast.error("Please enter a client name");
      return;
    }

    try {
      const client = await createClientMutation.mutateAsync({
        name: newClientName.trim(),
      });
      setSelectedClientId(client.id);
      setNewClientName("");
      setIsCreatingClient(false);
      toast.success("Client created!");
    } catch {
      toast.error("Failed to create client");
    }
  };

  const handleNextStep = async () => {
    if (!newCampaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }

    try {
      const campaign = await createMutation.mutateAsync({
        name: newCampaignName.trim(),
        clientId: selectedClientId || undefined,
        listId: selectedListId || undefined,
      });
      setCreatedCampaignId(campaign.id);

      // If a list was selected, skip the upload step
      if (selectedListId) {
        toast.success("Campaign created!");
        setIsCreateOpen(false);
        resetCreateDialog();
      } else {
        setCreateStep("leads");
      }
    } catch {
      toast.error("Failed to create campaign");
    }
  };

  const handleSkipUpload = () => {
    toast.success("Campaign created!");
    setIsCreateOpen(false);
    resetCreateDialog();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Campaign deleted");
    } catch {
      toast.error("Failed to delete campaign");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">Campaigns</h1>
          <p className="text-muted-foreground text-sm">
            Manage your outreach campaigns and track progress
          </p>
        </div>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetCreateDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            {createStep === "info" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Campaign Name</Label>
                    <Input
                      id="name"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="e.g., Acme Corp Outreach"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client">Client</Label>
                    {isCreatingClient ? (
                      <div className="flex gap-2">
                        <Input
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          placeholder="Client name"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handleCreateClient}
                          disabled={createClientMutation.isPending}
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsCreatingClient(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Select
                          value={selectedClientId}
                          onValueChange={setSelectedClientId}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsCreatingClient(true)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="list">Existing List (Optional)</Label>
                    <Select
                      value={selectedListId || "none"}
                      onValueChange={(value) => setSelectedListId(value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a list or upload CSV next" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {lists?.data?.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="w-3 h-3" />
                              {list.name} ({list.leadCount} leads)
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Select an existing list or upload a CSV on the next step.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      disabled={createMutation.isPending}
                    >
                      {selectedListId ? "Create Campaign" : "Next"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Add Leads to Campaign</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {createdCampaignId && (
                    <CsvUploader
                      campaignId={createdCampaignId}
                      onSuccess={() => {
                        setIsCreateOpen(false);
                        resetCreateDialog();
                      }}
                    />
                  )}

                  <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={handleSkipUpload}>
                      Skip for now
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients?.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border rounded-xl p-4 h-48 animate-pulse"
            >
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-card">
          <h3 className="text-lg font-medium text-foreground mb-2">
            No campaigns yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Create your first campaign to start reaching out to leads.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data?.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
