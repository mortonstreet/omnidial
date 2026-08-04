"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Users,
  Phone,
  CheckCircle,
  ExternalLink,
  FileText,
  ListPlus,
  Search,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CsvUploader } from "@/components/campaigns/CsvUploader";
import { ScriptManager } from "@/components/campaigns/ScriptManager";
import {
  useCampaign,
  useCampaignLeads,
} from "@/hooks/api/useCampaigns";
import {
  useLists,
  useCampaignLists,
  useAddListToCampaign,
} from "@/hooks/api/useLists";
import { toast } from "sonner";
export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAddListsOpen, setIsAddListsOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [isAddingLists, setIsAddingLists] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);

  const { data: campaign, isLoading: campaignLoading } = useCampaign(campaignId);
  const { data: leadsData, isLoading: leadsLoading } = useCampaignLeads({
    campaignId,
    page: leadsPage,
    limit: 20,
  });
  const { data: listsData, isLoading: listsLoading } = useLists({ search: listSearch, limit: 100 });
  const { data: campaignListsData } = useCampaignLists(campaignId);
  const addListToCampaign = useAddListToCampaign();

  const alreadyAddedListIds = new Set(
    campaignListsData?.data?.map((cl) => cl.listId) ?? []
  );

  const handleAddLists = async () => {
    if (selectedListIds.size === 0) return;
    setIsAddingLists(true);
    let totalLeadsAdded = 0;
    try {
      for (const listId of selectedListIds) {
        const result = await addListToCampaign.mutateAsync({
          campaignId,
          listId,
        });
        totalLeadsAdded += result?.leadsAdded ?? 0;
      }
      toast.success(
        `Added ${selectedListIds.size} list${selectedListIds.size > 1 ? "s" : ""} (${totalLeadsAdded} leads) to campaign`
      );
      setSelectedListIds(new Set());
      setListSearch("");
      setIsAddListsOpen(false);
    } catch {
      toast.error("Failed to add some lists to campaign");
    } finally {
      setIsAddingLists(false);
    }
  };

  const toggleListSelection = (listId: string) => {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  // Note: Campaign status toggle not yet implemented in backend
  const statusColors = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };

  if (campaignLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-1/4" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
        <Button variant="outline" onClick={() => router.push("/dashboard/campaigns")}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const connectionRate =
    campaign.dialedCount > 0
      ? Math.round((campaign.connectedCount / campaign.dialedCount) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/campaigns")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className={statusColors[campaign.status as keyof typeof statusColors]}
            >
              {campaign.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={isAddListsOpen}
            onOpenChange={(open) => {
              setIsAddListsOpen(open);
              if (!open) {
                setSelectedListIds(new Set());
                setListSearch("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <ListPlus className="w-4 h-4 mr-2" />
                + Add List
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Lists to Campaign</DialogTitle>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search lists..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-[320px] overflow-y-auto space-y-1 -mx-1 px-1">
                {listsLoading ? (
                  <div className="space-y-2 py-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : listsData?.data?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {listSearch ? "No lists match your search" : "No lists found"}
                  </div>
                ) : (
                  listsData?.data?.map((list) => {
                    const isAlreadyAdded = alreadyAddedListIds.has(list.id);
                    const isSelected = selectedListIds.has(list.id);
                    return (
                      <label
                        key={list.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          isAlreadyAdded
                            ? "opacity-50 cursor-not-allowed"
                            : isSelected
                            ? "bg-primary/5 border border-primary/20"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={isAlreadyAdded || isSelected}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => {
                            if (!isAlreadyAdded) toggleListSelection(list.id);
                          }}
                        />
                        <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {list.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {list.leadCount} lead{list.leadCount !== 1 ? "s" : ""}
                            {list.folderName && ` · ${list.folderName}`}
                            {isAlreadyAdded && " · Already added"}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddListsOpen(false)}
                  disabled={isAddingLists}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLists}
                  disabled={selectedListIds.size === 0 || isAddingLists}
                >
                  {isAddingLists ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    `Add ${selectedListIds.size > 0 ? selectedListIds.size + " " : ""}List${selectedListIds.size !== 1 ? "s" : ""}`
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Leads CSV</DialogTitle>
              </DialogHeader>
              <CsvUploader
                campaignId={campaignId}
                onSuccess={() => setIsUploadOpen(false)}
              />
            </DialogContent>
          </Dialog>
{/* Campaign pause/resume not yet implemented */}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="w-4 h-4" />
            <span className="text-sm">Total Leads</span>
          </div>
          <div className="text-3xl font-bold">{campaign.leadCount}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Phone className="w-4 h-4" />
            <span className="text-sm">Dialed</span>
          </div>
          <div className="text-3xl font-bold">{campaign.dialedCount}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Connected</span>
          </div>
          <div className="text-3xl font-bold">{campaign.connectedCount}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <span className="text-sm">Connect Rate</span>
          </div>
          <div className="text-3xl font-bold">{connectionRate}%</div>
        </div>
      </div>

      <Tabs defaultValue="leads" className="w-full">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="scripts">
            <FileText className="w-4 h-4 mr-1" />
            Scripts
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          {leadsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : leadsData?.data?.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-card">
              <h3 className="text-lg font-medium text-foreground mb-2">
                No leads in this campaign
              </h3>
              <p className="text-muted-foreground mb-4">
                Add leads from your lists or upload a CSV file.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setIsAddListsOpen(true)}>
                  <ListPlus className="w-4 h-4 mr-2" />
                  + Add List
                </Button>
                <Button variant="outline" onClick={() => setIsUploadOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                </Button>
              </div>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsData?.data?.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {lead.firstName || lead.lastName
                              ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim()
                              : "Unknown"}
                          </div>
                          {lead.email && (
                            <div className="text-sm text-muted-foreground">
                              {lead.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>
                        {lead.company && (
                          <div>
                            <div>{lead.company}</div>
                            {lead.title && (
                              <div className="text-sm text-muted-foreground">
                                {lead.title}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            lead.status === "completed"
                              ? "bg-green-500/10 text-green-500"
                              : lead.status === "dialed"
                              ? "bg-yellow-500/10 text-yellow-500"
                              : ""
                          }
                        >
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/dashboard/leads/${lead.leadId}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          {lead.linkedInUrl && (
                            <a
                              href={lead.linkedInUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {leadsData?.pagination && leadsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(leadsPage - 1) * 20 + 1} -{" "}
                    {Math.min(leadsPage * 20, leadsData.pagination.total)} of{" "}
                    {leadsData.pagination.total}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!leadsData.pagination.hasPrevPage}
                      onClick={() => setLeadsPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!leadsData.pagination.hasNextPage}
                      onClick={() => setLeadsPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scripts" className="mt-4">
          <ScriptManager campaignId={campaignId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="bg-card border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Campaign Settings</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Campaign Name
                </div>
                <div className="text-foreground">{campaign.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Created
                </div>
                <div className="text-foreground">
                  {new Date(campaign.createdAt).toLocaleDateString()}
                </div>
              </div>
              {campaign.assignedUsers && campaign.assignedUsers.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Assigned Users
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {campaign.assignedUsers.map((user) => (
                      <Badge key={user.id} variant="outline">
                        {user.name || user.email}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
