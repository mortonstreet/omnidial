"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileSpreadsheet,
  Users,
  Pencil,
  Trash2,
  Link2,
  Search,
  MoreHorizontal,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Phone,
  GitBranch,
  Eye,
  ChevronDown,
} from "lucide-react";
import { Logo3DSpinner } from "@/components/ui/Logo3DSpinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarkLeadsDnc, useRemoveListLeads } from "@/hooks/api/useDnc";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CsvUploader } from "@/components/lists/CsvUploader";
import { GoogleSheetsExportModal } from "@/components/sheets/GoogleSheetsExportModal";
import { GoogleSheetsIcon } from "@/components/icons/GoogleSheetsIcon";
import {
  useList,
  useListLeads,
  useUpdateList,
  useDeleteList,
  useAddListToCampaign,
  useUpdateLead,
} from "@/hooks/api/useLists";
import { EditableCell } from "@/components/lists/EditableCell";
import { useCampaigns } from "@/hooks/api/useCampaigns";
import { usePipelineStages } from "@/hooks/api/usePipeline";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useActiveOrganization } from "@/lib/auth-client";
import { ENDPOINTS, env } from "@/lib/config";
import { getAuthHeaders } from "@/lib/api";
import { useQuickCall } from "@/hooks/useQuickCall";
import { useOrganizationAdmin } from "@/hooks/useOrganizationAdmin";
import { useBulkProspeoListMobileEnrich } from "@/hooks/api/useEnrichment";

export default function ListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLinkCampaignOpen, setIsLinkCampaignOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [showSheetsExport, setShowSheetsExport] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    new Set()
  );

  const { data: list, isLoading: isLoadingList, refetch } = useList(listId);
  const { data: leadsData, isLoading: isLoadingLeads } = useListLeads({
    listId,
    search: search || undefined,
    page,
    limit: 20,
  });
  const { data: campaignsData } = useCampaigns({ limit: 100 });
  const { data: stagesData } = usePipelineStages();

  const updateMutation = useUpdateList();
  const deleteMutation = useDeleteList();
  const linkCampaignMutation = useAddListToCampaign();
  const updateLeadMutation = useUpdateLead(listId);
  const prospeoMobileMutation = useBulkProspeoListMobileEnrich();
  const canManageLists = useOrganizationAdmin();

  const leads = leadsData?.data ?? [];
  const pagination = leadsData?.pagination;
  const campaigns = campaignsData?.data ?? [];
  const pipelineStages = stagesData?.data ?? [];
  const eligibleLeadIdsOnPage = leads
    .filter((lead) => !!lead.linkedInUrl?.trim())
    .map((lead) => lead.id);
  const selectedLeadCount = selectedLeadIds.size;
  const markDnc = useMarkLeadsDnc();
  const removeFromList = useRemoveListLeads();

  // DNC suppresses every number org-wide; removal only drops the list entry,
  // which stays restorable.
  const handleMarkDnc = async () => {
    const leadIds = Array.from(selectedLeadIds);
    if (leadIds.length === 0) return;
    if (
      !confirm(
        `Move ${leadIds.length} lead(s) to DNC? Every phone number they have will be suppressed across the organisation and they will be pulled from all campaigns and lists.`,
      )
    )
      return;

    try {
      const result = await markDnc.mutateAsync({ leadIds });
      toast.success(`${result.leadsMarked} lead(s) moved to DNC`, {
        description: `${result.numbersSuppressed} number(s) suppressed.`,
      });
      setSelectedLeadIds(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to move to DNC",
      );
    }
  };

  const handleRemoveFromList = async () => {
    const leadIds = Array.from(selectedLeadIds);
    if (leadIds.length === 0) return;

    try {
      const result = await removeFromList.mutateAsync({ listId, leadIds });
      toast.success(`${result.removed} lead(s) removed from this list`, {
        description: "The lead records are unchanged and stay dialable.",
      });
      setSelectedLeadIds(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove leads",
      );
    }
  };
  const selectedEligibleOnPageCount = eligibleLeadIdsOnPage.filter((leadId) =>
    selectedLeadIds.has(leadId)
  ).length;
  const allEligibleOnPageSelected =
    eligibleLeadIdsOnPage.length > 0 &&
    selectedEligibleOnPageCount === eligibleLeadIdsOnPage.length;
  const someEligibleOnPageSelected =
    selectedEligibleOnPageCount > 0 && !allEligibleOnPageSelected;

  const handleEdit = async () => {
    if (!editName.trim()) {
      toast.error("Please enter a name");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: listId,
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      toast.success("List updated!");
      setIsEditOpen(false);
    } catch {
      toast.error("Failed to update list");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this list?")) return;

    try {
      await deleteMutation.mutateAsync(listId);
      toast.success("List deleted");
      router.push("/dashboard/lists");
    } catch {
      toast.error("Failed to delete list");
    }
  };

  const handleLinkCampaign = async () => {
    if (!selectedCampaignId) {
      toast.error("Please select a campaign");
      return;
    }

    try {
      const result = await linkCampaignMutation.mutateAsync({
        campaignId: selectedCampaignId,
        listId,
      });
      toast.success(
        `List linked! ${result.leadsAdded} leads added to campaign.`
      );
      setIsLinkCampaignOpen(false);
      setSelectedCampaignId("");
    } catch {
      toast.error("Failed to link list to campaign");
    }
  };

  const handleToggleLeadSelection = (leadId: string, checked: boolean) => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(leadId);
      } else {
        next.delete(leadId);
      }
      return next;
    });
  };

  const handleTogglePageSelection = (checked: boolean) => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      eligibleLeadIdsOnPage.forEach((leadId) => {
        if (checked) {
          next.add(leadId);
        } else {
          next.delete(leadId);
        }
      });
      return next;
    });
  };

  const handleSelectEligiblePage = () => {
    handleTogglePageSelection(true);
  };

  const handleProspeoMobileEnrich = async () => {
    if (!list) return;

    const leadIds = Array.from(selectedLeadIds);
    const scope =
      leadIds.length > 0
        ? `${leadIds.length.toLocaleString()} selected lead${
            leadIds.length === 1 ? "" : "s"
          }`
        : `all ${list.leadCount.toLocaleString()} leads in this list`;

    if (
      !confirm(
        `Run Prospeo verified mobile enrichment for ${scope}? Leads without LinkedIn URLs will be skipped.`
      )
    ) {
      return;
    }

    try {
      const result = await prospeoMobileMutation.mutateAsync({
        listId,
        leadIds: leadIds.length > 0 ? leadIds : undefined,
      });
      const skippedText =
        result.totalSkipped > 0
          ? ` ${result.totalSkipped.toLocaleString()} skipped.`
          : "";
      const failedText =
        result.totalFailed > 0
          ? ` ${result.totalFailed.toLocaleString()} failed.`
          : "";

      if (result.totalUpdated > 0) {
        toast.success(
          `Added verified mobiles to ${result.totalUpdated.toLocaleString()} lead${
            result.totalUpdated === 1 ? "" : "s"
          }.${skippedText}${failedText}`
        );
      } else if (result.totalFailed > 0) {
        toast.error(`Prospeo enrichment failed.${skippedText}${failedText}`);
      } else {
        toast.info(`No valid mobile numbers returned.${skippedText}`);
      }

      setSelectedLeadIds(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to run Prospeo enrichment"
      );
    }
  };

  const handleExport = async () => {
    if (!orgId || !list) return;

    setIsExporting(true);
    try {
      const response = await fetch(
        `${env.API_URL}${ENDPOINTS.LISTS.EXPORT(listId)}?organizationId=${orgId}`,
        {
          credentials: "include",
          headers: await getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${list.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export downloaded!");
    } catch {
      toast.error("Failed to export list");
    } finally {
      setIsExporting(false);
    }
  };

  const openEditDialog = () => {
    if (list) {
      setEditName(list.name);
      setEditDescription(list.description || "");
      setIsEditOpen(true);
    }
  };

  const handleUpdateLead = async (
    leadId: string,
    field: string,
    value: string
  ) => {
    try {
      await updateLeadMutation.mutateAsync({
        leadId,
        data: { [field]: value || null },
      });
      toast.success("Lead updated");
    } catch {
      toast.error("Failed to update lead");
      throw new Error("Update failed");
    }
  };

  const handleAddToPipeline = async (leadId: string, stageId: string, stageName: string) => {
    try {
      await updateLeadMutation.mutateAsync({
        leadId,
        data: { pipelineStageId: stageId },
      });
      toast.success(`Lead added to ${stageName}`);
    } catch {
      toast.error("Failed to add lead to pipeline");
    }
  };

  const { quickCall } = useQuickCall();

  const handleCallLead = (phone: string, leadId: string, leadName?: string) => {
    quickCall({ leadId, leadName: leadName || "Unknown", phone });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "failed":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "processing":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "completed":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "";
    }
  };

  if (isLoadingList) {
    return (
      <div className="flex items-center justify-center h-64">
        <Logo3DSpinner size={80} />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium">List not found</h2>
        <Link href="/dashboard/lists">
          <Button variant="link">Go back to lists</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/lists">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{list.name}</h1>
                <Badge
                  variant="outline"
                  className={cn("text-xs", getStatusColor(list.importStatus))}
                >
                  {getStatusIcon(list.importStatus)}
                  <span className="ml-1 capitalize">{list.importStatus}</span>
                </Badge>
              </div>
              {list.description && (
                <p className="text-muted-foreground mt-1">{list.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {list.leadCount.toLocaleString()} leads
                </span>
                {list.folderName && <span>in {list.folderName}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleProspeoMobileEnrich}
            disabled={prospeoMobileMutation.isPending || list.leadCount === 0}
          >
            {prospeoMobileMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Phone className="w-4 h-4 mr-2" />
            )}
            Prospeo Mobile
            {selectedLeadCount > 0 && (
              <span>({selectedLeadCount.toLocaleString()})</span>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting || list.leadCount === 0}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSheetsExport(true)}>
                <GoogleSheetsIcon className="w-4 h-4 mr-2" />
                Export to Google Sheets
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManageLists && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLinkCampaignOpen(true)}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Add to Campaign
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openEditDialog}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* CSV Upload Section */}
      {canManageLists && (
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Upload Leads</h2>
          <CsvUploader listId={listId} onUploadComplete={() => refetch()} />
        </div>
      )}

      {/* Import Error */}
      {list.importStatus === "failed" && list.importError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Import Failed</span>
          </div>
          <p className="text-sm text-destructive/80 mt-1">{list.importError}</p>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-card border rounded-xl">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Leads</h2>
            {selectedLeadCount > 0 && (
              <Badge variant="secondary">
                {selectedLeadCount.toLocaleString()} selected
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {eligibleLeadIdsOnPage.length > 0 && selectedLeadCount === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectEligiblePage}
                disabled={prospeoMobileMutation.isPending}
              >
                Select LinkedIn Page
              </Button>
            )}
            {selectedLeadCount > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveFromList}
                  disabled={removeFromList.isPending || markDnc.isPending}
                >
                  Remove from list
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleMarkDnc}
                  disabled={removeFromList.isPending || markDnc.isPending}
                >
                  Move to DNC
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLeadIds(new Set())}
                >
                  Clear
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleProspeoMobileEnrich}
              disabled={
                prospeoMobileMutation.isPending || list.leadCount === 0
              }
            >
              {prospeoMobileMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Phone className="w-4 h-4 mr-2" />
              )}
              Prospeo Mobile
              {selectedLeadCount > 0 && (
                <span>({selectedLeadCount.toLocaleString()})</span>
              )}
            </Button>
            <div className="relative w-64">
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
          </div>
        </div>

        {isLoadingLeads ? (
          <div className="flex items-center justify-center py-12">
            <Logo3DSpinner size={64} />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search
              ? "No leads match your search"
              : canManageLists
              ? "No leads yet. Upload a CSV to add leads."
              : "No leads yet."}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        allEligibleOnPageSelected
                          ? true
                          : someEligibleOnPageSelected
                          ? "indeterminate"
                          : false
                      }
                      disabled={
                        eligibleLeadIdsOnPage.length === 0 ||
                        prospeoMobileMutation.isPending
                      }
                      onCheckedChange={(checked) =>
                        handleTogglePageSelection(checked === true)
                      }
                      aria-label="Select eligible leads on this page"
                    />
                  </TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const hasLinkedInUrl = !!lead.linkedInUrl?.trim();
                  const isSelected = selectedLeadIds.has(lead.id);

                  return (
                    <TableRow
                      key={lead.entryId}
                      className={isSelected ? "bg-muted/50" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          disabled={
                            !hasLinkedInUrl || prospeoMobileMutation.isPending
                          }
                          onCheckedChange={(checked) =>
                            handleToggleLeadSelection(
                              lead.id,
                              checked === true
                            )
                          }
                          aria-label={
                            hasLinkedInUrl
                              ? "Select lead for Prospeo mobile enrichment"
                              : "Lead requires a LinkedIn URL for Prospeo mobile enrichment"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={lead.firstName}
                          onSave={(v) =>
                            handleUpdateLead(lead.id, "firstName", v)
                          }
                          placeholder="-"
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={lead.lastName}
                          onSave={(v) =>
                            handleUpdateLead(lead.id, "lastName", v)
                          }
                          placeholder="-"
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={lead.phone}
                          onSave={(v) => handleUpdateLead(lead.id, "phone", v)}
                          type="phone"
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={lead.email}
                          onSave={(v) => handleUpdateLead(lead.id, "email", v)}
                          placeholder="-"
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={lead.company}
                          onSave={(v) =>
                            handleUpdateLead(lead.id, "company", v)
                          }
                          placeholder="-"
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={lead.title}
                          onSave={(v) => handleUpdateLead(lead.id, "title", v)}
                          placeholder="-"
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/leads/${lead.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Lead
                              </Link>
                            </DropdownMenuItem>
                            {lead.phone && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleCallLead(
                                    lead.phone,
                                    lead.id,
                                    [lead.firstName, lead.lastName]
                                      .filter(Boolean)
                                      .join(" ")
                                  )
                                }
                              >
                                <Phone className="w-4 h-4 mr-2" />
                                Call
                              </DropdownMenuItem>
                            )}
                            {pipelineStages.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                  <GitBranch className="w-3 h-3 inline mr-1" />
                                  Add to Pipeline
                                </DropdownMenuLabel>
                                {pipelineStages.map((stage) => (
                                  <DropdownMenuItem
                                    key={stage.id}
                                    onClick={() =>
                                      handleAddToPipeline(
                                        lead.id,
                                        stage.id,
                                        stage.label
                                      )
                                    }
                                  >
                                    <div
                                      className="w-2 h-2 rounded-full mr-2"
                                      style={{ backgroundColor: stage.color }}
                                    />
                                    {stage.label}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="p-4 border-t flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} leads
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link to Campaign Dialog */}
      <Dialog open={isLinkCampaignOpen} onOpenChange={setIsLinkCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add List to Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              All {list.leadCount} leads from this list will be added to the
              selected campaign.
            </p>
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select
                value={selectedCampaignId}
                onValueChange={setSelectedCampaignId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No campaigns found. Create a campaign first.
                    </div>
                  ) : (
                    campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        <span className="flex items-center gap-2">
                          {campaign.name}
                          <Badge
                            variant="outline"
                            className={
                              campaign.status === "active"
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                            }
                          >
                            {campaign.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsLinkCampaignOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLinkCampaign}
                disabled={linkCampaignMutation.isPending || !selectedCampaignId}
              >
                {linkCampaignMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add to Campaign"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Sheets Export Modal */}
      <GoogleSheetsExportModal
        isOpen={showSheetsExport}
        onClose={() => setShowSheetsExport(false)}
        dataType="list"
        listId={listId}
        listName={list.name}
      />
    </div>
  );
}
