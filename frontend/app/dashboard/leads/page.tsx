"use client";

import { useState } from "react";
import { Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LeadTable } from "@/components/leads/LeadTable";
import { MobileLeadCard } from "@/components/leads/MobileLeadCard";
import { BulkActionBar } from "@/components/leads/BulkActionBar";
import { SmartQueryModal } from "@/components/leads/SmartQueryModal";
import { useLeads, useCreateLead, useDeleteLead } from "@/hooks/api/useLeads";
import { useLeadSelection } from "@/hooks/useLeadSelection";
import { toast } from "sonner";

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSmartQueryOpen, setIsSmartQueryOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{
    filters: Record<string, unknown>;
    humanReadable: string;
  } | null>(null);
  const [newLead, setNewLead] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    title: "",
    linkedInUrl: "",
    website: "",
  });

  const selection = useLeadSelection();

  // Build smart filter params from active filter
  const smartFilters = activeFilter?.filters || {};
  const titleFilter = smartFilters.title as { operator: string; value: string | number | boolean | null } | undefined;
  const emailFilter = smartFilters.email as { operator: string; value: string | number | boolean | null } | undefined;
  const companyFilter = smartFilters.company as { operator: string; value: string | number | boolean | null } | undefined;
  const createdAtFilter = smartFilters.createdAt as { operator: string; value: string | number | boolean | null } | undefined;

  const { data, isLoading, refetch } = useLeads({
    search: search || undefined,
    page,
    limit: 20,
    titleFilter,
    emailFilter,
    companyFilter,
    createdAtFilter,
  });

  const createMutation = useCreateLead();
  const deleteMutation = useDeleteLead();

  const handleCreate = async () => {
    if (!newLead.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    try {
      await createMutation.mutateAsync({
        ...newLead,
        firstName: newLead.firstName || undefined,
        lastName: newLead.lastName || undefined,
        email: newLead.email || undefined,
        company: newLead.company || undefined,
        title: newLead.title || undefined,
        linkedInUrl: newLead.linkedInUrl || undefined,
        website: newLead.website || undefined,
      });
      toast.success("Lead created!");
      setIsCreateOpen(false);
      setNewLead({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        title: "",
        linkedInUrl: "",
        website: "",
      });
    } catch {
      toast.error("Failed to create lead");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Lead deleted");
    } catch {
      toast.error("Failed to delete lead");
    }
  };

  const handleApplySmartQuery = (
    filters: Record<string, unknown>,
    humanReadable: string
  ) => {
    setActiveFilter({ filters, humanReadable });
    setPage(1);
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">
            Leads
          </h1>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newLead.firstName}
                    onChange={(e) =>
                      setNewLead({ ...newLead, firstName: e.target.value })
                    }
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newLead.lastName}
                    onChange={(e) =>
                      setNewLead({ ...newLead, lastName: e.target.value })
                    }
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="phone"
                  value={newLead.phone}
                  onChange={(e) =>
                    setNewLead({ ...newLead, phone: e.target.value })
                  }
                  placeholder="+1 555 123 4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newLead.email}
                  onChange={(e) =>
                    setNewLead({ ...newLead, email: e.target.value })
                  }
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={newLead.company}
                    onChange={(e) =>
                      setNewLead({ ...newLead, company: e.target.value })
                    }
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newLead.title}
                    onChange={(e) =>
                      setNewLead({ ...newLead, title: e.target.value })
                    }
                    placeholder="VP of Sales"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="linkedInUrl">LinkedIn URL</Label>
                  <Input
                    id="linkedInUrl"
                    value={newLead.linkedInUrl}
                    onChange={(e) =>
                      setNewLead({ ...newLead, linkedInUrl: e.target.value })
                    }
                    placeholder="https://linkedin.com/in/johndoe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={newLead.website}
                    onChange={(e) =>
                      setNewLead({ ...newLead, website: e.target.value })
                    }
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  Add Lead
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setIsSmartQueryOpen(true)}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Smart Query
        </Button>
      </div>

      {/* Active Filter Badge */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1.5">
            <span className="text-sm">{activeFilter.humanReadable}</span>
            <button
              onClick={handleClearFilter}
              className="hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selection.selectedCount}
        selectedIds={selection.selectedArray}
        onClear={selection.clearSelection}
        onDelete={async () => {
          if (!confirm(`Are you sure you want to delete ${selection.selectedCount} lead${selection.selectedCount !== 1 ? 's' : ''}?`)) return;

          try {
            await Promise.all(selection.selectedArray.map(id => deleteMutation.mutateAsync(id)));
            toast.success(`Deleted ${selection.selectedCount} lead${selection.selectedCount !== 1 ? 's' : ''}`);
            selection.clearSelection();
          } catch {
            toast.error("Failed to delete some leads");
          }
        }}
        onAddToCampaignSuccess={() => {
          refetch();
        }}
        onEnrichSuccess={() => {
          refetch();
        }}
      />

      {/* Lead List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-card">
          <h3 className="text-lg font-medium text-foreground mb-2">
            No leads yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Add leads manually or upload a CSV to a campaign.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <LeadTable
              leads={data?.data || []}
              onDelete={handleDelete}
              selectable
              selectedIds={selection.selectedIds}
              onToggleSelection={selection.toggleSelection}
              onToggleAllOnPage={selection.toggleAllOnPage}
              isAllOnPageSelected={selection.isAllOnPageSelected}
              isSomeOnPageSelected={selection.isSomeOnPageSelected}
            />
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            {data?.data?.map((lead) => (
              <MobileLeadCard
                key={lead.id}
                lead={lead}
              />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1} -{" "}
            {Math.min(page * 20, data.pagination.total)} of{" "}
            {data.pagination.total} leads
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data.pagination.hasPrevPage}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Smart Query Modal */}
      <SmartQueryModal
        open={isSmartQueryOpen}
        onOpenChange={setIsSmartQueryOpen}
        onApply={handleApplySmartQuery}
      />
    </div>
  );
}
