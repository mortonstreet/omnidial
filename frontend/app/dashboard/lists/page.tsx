"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PlusCircle,
  Search,
  Folder,
  FileSpreadsheet,
  MoreHorizontal,
  Info,
  Pencil,
  Star,
  FolderInput,
  Trash2,
  X,
  Loader2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Logo3DSpinner } from "@/components/ui/Logo3DSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useLists,
  useFolders,
  useCreateList,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useUpdateList,
  useDeleteList,
  useFavorites,
  useFavoriteIds,
  useToggleFavorite,
  useRecents,
  useRecordListOpen,
  useRecordFolderOpen,
  usePrefetchFolderLists,
  useAddListToCampaign,
} from "@/hooks/api/useLists";
import { useCampaigns } from "@/hooks/api/useCampaigns";
import { useListOrganizationMembers } from "@/hooks/api/useOrganization";
import { useEnrichList } from "@/hooks/api/useEnrichment";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabType = "all" | "recents" | "favorites";

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface DetailsSidebarItem {
  type: "folder" | "list";
  id: string;
  name: string;
  description?: string;
  color?: string;
  leadCount?: number;
  createdAt: string;
  folderId?: string;
}

interface OrganizationMember {
  userId: string;
  role: string;
  user?: {
    name?: string | null;
    email?: string;
  };
}

interface ListWithCreator {
  createdById?: string;
}

export default function ListsPage() {
  const router = useRouter();

  // View state
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [folderPath, setFolderPath] = useState<BreadcrumbItem[]>([]);
  const [search, setSearch] = useState("");

  // Current folder is the last item in the path
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null;

  // Details sidebar
  const [detailsItem, setDetailsItem] = useState<DetailsSidebarItem | null>(null);

  // Create dialog (for both list and folder)
  const [createType, setCreateType] = useState<"list" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Rename dialog
  const [renamingItem, setRenamingItem] = useState<{ type: "folder" | "list"; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Move dialog
  const [movingList, setMovingList] = useState<{ id: string; name: string; folderId?: string } | null>(null);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");

  // Add to Campaign dialog
  const [addToCampaignList, setAddToCampaignList] = useState<{ id: string; name: string } | null>(null);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");

  // Data fetching
  const { data: listsData, isLoading: isLoadingLists } = useLists({
    folderId: currentFolderId ?? undefined,
    search: search || undefined,
  });
  const { data: foldersData, isLoading: isLoadingFolders } = useFolders();

  const createListMutation = useCreateList();
  const createFolderMutation = useCreateFolder();
  const updateFolderMutation = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();
  const addListToCampaignMutation = useAddListToCampaign();
  const enrichListMutation = useEnrichList();

  // Fetch campaigns for "Add to Campaign" dialog
  const { data: campaignsData } = useCampaigns();

  // Favorites and Recents
  const { data: favoritesData } = useFavorites();
  const { data: favoriteIdsData } = useFavoriteIds();
  const { data: recentsData } = useRecents();
  const toggleFavoriteMutation = useToggleFavorite();
  const recordListOpenMutation = useRecordListOpen();
  const recordFolderOpenMutation = useRecordFolderOpen();
  const prefetchFolderLists = usePrefetchFolderLists();

  // Organization members for owner display and filter
  const { data: membersData } = useListOrganizationMembers();
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);

  const allLists = useMemo(() => listsData?.data ?? [], [listsData?.data]);
  const allFolders = useMemo(() => foldersData?.data ?? [], [foldersData?.data]);

  // User map for owner display
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    const members = membersData?.data?.members;
    if (members) {
      for (const member of members) {
        map.set(member.userId, member.user?.name || member.user?.email || "Unknown");
      }
    }
    return map;
  }, [membersData]);

  // Favorite IDs for quick lookups
  const favoriteListIds = useMemo(() => new Set(favoriteIdsData?.listIds ?? []), [favoriteIdsData?.listIds]);
  const favoriteFolderIds = useMemo(() => new Set(favoriteIdsData?.folderIds ?? []), [favoriteIdsData?.folderIds]);

  // Create lookup map for "Last opened by me" timestamps from recents data
  const openedAtMap = useMemo(() => {
    const map = new Map<string, string>();
    const recents = recentsData?.data ?? [];
    for (const item of recents) {
      // Use a composite key: type-id to handle both lists and folders
      map.set(`${item.type}-${item.id}`, item.openedAt);
    }
    return map;
  }, [recentsData]);

  // Combine and filter items based on current location and active tab
  const items = useMemo(() => {
    let result: Array<
      | { type: "folder"; data: typeof allFolders[0]; openedAt?: string }
      | { type: "list"; data: typeof allLists[0]; openedAt?: string }
    > = [];

    // Handle Favorites tab
    if (activeTab === "favorites") {
      const favLists = favoritesData?.lists ?? [];
      const favFolders = favoritesData?.folders ?? [];
      favFolders.forEach((f) => result.push({
        type: "folder",
        data: f as typeof allFolders[0],
        openedAt: openedAtMap.get(`folder-${f.id}`),
      }));
      favLists.forEach((l) => result.push({
        type: "list",
        data: l as typeof allLists[0],
        openedAt: openedAtMap.get(`list-${l.id}`),
      }));
    }
    // Handle Recents tab - use data directly from backend (includes full objects)
    else if (activeTab === "recents") {
      const recents = recentsData?.data ?? [];
      for (const item of recents) {
        if (item.type === "folder") {
          // Backend returns full folder data with openedAt
          result.push({
            type: "folder",
            data: item as typeof allFolders[0],
            openedAt: item.openedAt,
          });
        } else {
          // Backend returns full list data with openedAt
          result.push({
            type: "list",
            data: item as typeof allLists[0],
            openedAt: item.openedAt,
          });
        }
      }
    }
    // Handle All tab
    else if (search) {
      // Search across all items
      const searchLower = search.toLowerCase();
      allFolders
        .filter((f) => f.name.toLowerCase().includes(searchLower))
        .forEach((f) => result.push({
          type: "folder",
          data: f,
          openedAt: openedAtMap.get(`folder-${f.id}`),
        }));
      allLists
        .filter(
          (l) =>
            l.name.toLowerCase().includes(searchLower) ||
            l.description?.toLowerCase().includes(searchLower)
        )
        .forEach((l) => result.push({
          type: "list",
          data: l,
          openedAt: openedAtMap.get(`list-${l.id}`),
        }));
    } else if (currentFolderId) {
      // Inside a folder - show only items IN this folder
      // Subfolders with parentId = currentFolderId
      allFolders
        .filter((f) => f.parentId === currentFolderId)
        .forEach((f) => result.push({
          type: "folder",
          data: f,
          openedAt: openedAtMap.get(`folder-${f.id}`),
        }));
      // Lists with folderId = currentFolderId (already filtered by useLists hook)
      allLists.forEach((l) => result.push({
        type: "list",
        data: l,
        openedAt: openedAtMap.get(`list-${l.id}`),
      }));
    } else {
      // Home (root) - show only ROOT level items
      // Folders without a parent (parentId is null/undefined)
      allFolders
        .filter((f) => !f.parentId)
        .forEach((f) => result.push({
          type: "folder",
          data: f,
          openedAt: openedAtMap.get(`folder-${f.id}`),
        }));
      // Lists without a folder (folderId is null/undefined)
      allLists
        .filter((l) => !l.folderId)
        .forEach((l) => result.push({
          type: "list",
          data: l,
          openedAt: openedAtMap.get(`list-${l.id}`),
        }));
    }

    // Apply owner filter if set (only applies to lists which have createdById)
    if (ownerFilter) {
      result = result.filter((item) => {
        if (item.type === "list") {
          return (item.data as ListWithCreator).createdById === ownerFilter;
        }
        // Folders don't have createdById, so we exclude them when filtering by owner
        return false;
      });
    }

    return result;
  }, [search, currentFolderId, allFolders, allLists, activeTab, favoritesData, recentsData, ownerFilter, openedAtMap]);

  const isLoading = isLoadingLists || isLoadingFolders;

  // Filtered folders for move dialog
  const filteredFoldersForMove = useMemo(() => {
    if (!folderSearchQuery.trim()) return allFolders;
    const q = folderSearchQuery.toLowerCase();
    return allFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [allFolders, folderSearchQuery]);

  // Filtered campaigns for "Add to Campaign" dialog
  const allCampaigns = useMemo(() => campaignsData?.data ?? [], [campaignsData?.data]);
  const filteredCampaignsForAdd = useMemo(() => {
    if (!campaignSearchQuery.trim()) return allCampaigns;
    const q = campaignSearchQuery.toLowerCase();
    return allCampaigns.filter((c: { name: string }) => c.name.toLowerCase().includes(q));
  }, [allCampaigns, campaignSearchQuery]);

  // Get lists inside a folder for details sidebar
  const listsInFolder = useMemo(() => {
    if (!detailsItem || detailsItem.type !== "folder") return [];
    return allLists.filter((l) => l.folderId === detailsItem.id);
  }, [detailsItem, allLists]);

  // Get subfolders for details sidebar
  const subfoldersInFolder = useMemo(() => {
    if (!detailsItem || detailsItem.type !== "folder") return [];
    return allFolders.filter((f) => f.parentId === detailsItem.id);
  }, [detailsItem, allFolders]);

  // All folders are grey per Clay-inspired design
  const FOLDER_COLOR = "#6b7280";

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    // Prefetch folder contents BEFORE state update for instant navigation
    prefetchFolderLists(folderId);
    setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    setSearch("");
    // Record folder open for recents (fire and forget)
    recordFolderOpenMutation.mutate(folderId);
  };

  const navigateToList = (listId: string) => {
    // Record list open for recents
    recordListOpenMutation.mutate(listId);
    router.push(`/dashboard/lists/${listId}`);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Navigate to Home
      setFolderPath([]);
    } else {
      // Navigate to specific folder in path
      setFolderPath((prev) => prev.slice(0, index + 1));
    }
    setSearch("");
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error(`Please enter a ${createType} name`);
      return;
    }

    try {
      if (createType === "list") {
        await createListMutation.mutateAsync({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          folderId: currentFolderId,
        });
        toast.success("List created!");
      } else {
        await createFolderMutation.mutateAsync({
          name: newName.trim(),
          color: FOLDER_COLOR,
          parentId: currentFolderId,
        });
        toast.success("Folder created!");
      }
      setCreateType(null);
      setNewName("");
      setNewDescription("");
    } catch {
      toast.error(`Failed to create ${createType}`);
    }
  };

  const handleRename = async () => {
    if (!renamingItem || !renameValue.trim()) return;

    try {
      if (renamingItem.type === "folder") {
        const folder = allFolders.find((f) => f.id === renamingItem.id);
        await updateFolderMutation.mutateAsync({
          id: renamingItem.id,
          name: renameValue.trim(),
          color: folder?.color ?? "#6366f1",
        });
      } else {
        await updateListMutation.mutateAsync({
          id: renamingItem.id,
          name: renameValue.trim(),
        });
      }
      toast.success("Renamed successfully");
      setRenamingItem(null);
    } catch {
      toast.error("Failed to rename");
    }
  };

  const handleDelete = async (type: "folder" | "list", id: string) => {
    const message = type === "folder"
      ? "Delete this folder? Lists inside will move to root."
      : "Delete this list? This cannot be undone.";

    if (!confirm(message)) return;

    try {
      if (type === "folder") {
        await deleteFolderMutation.mutateAsync(id);
      } else {
        await deleteListMutation.mutateAsync(id);
      }
      toast.success(`${type === "folder" ? "Folder" : "List"} deleted`);
      if (detailsItem?.id === id) setDetailsItem(null);
    } catch {
      toast.error(`Failed to delete ${type}`);
    }
  };

  const handleMoveList = async (folderId: string | null) => {
    if (!movingList) return;
    try {
      await updateListMutation.mutateAsync({
        id: movingList.id,
        folderId,
      });
      toast.success(folderId ? "List moved to folder" : "List moved to root");
      setMovingList(null);
      setFolderSearchQuery("");
    } catch {
      toast.error("Failed to move list");
    }
  };

  const handleAddToCampaign = async (campaignId: string, campaignName: string) => {
    if (!addToCampaignList) return;
    try {
      const result = await addListToCampaignMutation.mutateAsync({
        campaignId,
        listId: addToCampaignList.id,
      });
      toast.success(`Added ${result.leadsAdded.toLocaleString()} leads from "${addToCampaignList.name}" to "${campaignName}"`);
      setAddToCampaignList(null);
      setCampaignSearchQuery("");
    } catch {
      toast.error("Failed to add list to campaign");
    }
  };

  const handleAddToFavorites = async (type: "folder" | "list", itemId: string, name: string) => {
    try {
      const result = await toggleFavoriteMutation.mutateAsync({ itemId, type });
      if (result.favorited) {
        toast.success(`Added "${name}" to favorites`);
      } else {
        toast.success(`Removed "${name}" from favorites`);
      }
    } catch {
      toast.error("Failed to update favorites");
    }
  };

  const openDetails = (item: typeof items[0]) => {
    if (item.type === "folder") {
      setDetailsItem({
        type: "folder",
        id: item.data.id,
        name: item.data.name,
        color: item.data.color,
        createdAt: item.data.createdAt,
      });
    } else {
      setDetailsItem({
        type: "list",
        id: item.data.id,
        name: item.data.name,
        description: item.data.description,
        leadCount: item.data.leadCount,
        createdAt: item.data.createdAt,
        folderId: item.data.folderId,
      });
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "All files" },
    { key: "recents", label: "Recents" },
    { key: "favorites", label: "Favorites" },
  ];

  // Get current folder name for title
  const currentFolderName = folderPath.length > 0 ? folderPath[folderPath.length - 1].name : "All Files";

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className={cn("flex-1 p-6 space-y-4 overflow-auto", detailsItem && "pr-0")}>
        {/* Page Title */}
        <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">
          Lists
        </h1>

        {/* Tabs */}
        <div className="flex items-center gap-1 border rounded-lg p-1 w-fit bg-muted/30">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setFolderPath([]);
                setSearch("");
              }}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeTab === tab.key
                  ? "bg-background text-primary shadow-sm border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className={cn(
              "hover:text-foreground transition-colors",
              folderPath.length === 0 && "text-foreground font-medium"
            )}
          >
            Home
          </button>
          {folderPath.map((item, index) => (
            <span key={item.id} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4" />
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={cn(
                  "hover:text-foreground transition-colors",
                  index === folderPath.length - 1 && "text-foreground font-medium"
                )}
              >
                {item.name}
              </button>
            </span>
          ))}
        </nav>

        {/* Title Row */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            {currentFolderName}
          </h1>

          <div className="flex items-center gap-3">
            {/* Owner Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  Owner: {ownerFilter ? userMap.get(ownerFilter) ?? "Unknown" : "All"}
                  <ChevronRight className="w-4 h-4 ml-1 rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setOwnerFilter(null)}>
                  All
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {membersData?.data?.members?.map((member: OrganizationMember) => (
                  <DropdownMenuItem
                    key={member.userId}
                    onClick={() => setOwnerFilter(member.userId)}
                  >
                    {member.user?.name || member.user?.email || "Unknown"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-64"
              />
            </div>

            {/* + New Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1" />
                  New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreateType("list")}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  New List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreateType("folder")}>
                  <Folder className="w-4 h-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg bg-card overflow-hidden">
          {/* Table element for proper column alignment */}
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-[40%]">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-[60px]">Tags</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-[120px]">Created at</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-[140px]">Last opened by me</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-[120px]">Owner</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-[60px]">Access</th>
                <th className="w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <div className="flex justify-center mb-2"><Logo3DSpinner size={64} /></div>
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      {search ? "No results found" : "No files or folders yet"}
                    </p>
                    {!search && (
                      <Button size="sm" onClick={() => setCreateType("list")}>
                        <Plus className="w-4 h-4 mr-1" />
                        Create your first list
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={`${item.type}-${item.data.id}`}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors group"
                    onMouseEnter={() => {
                      // Prefetch folder contents on hover for faster navigation
                      if (item.type === "folder") {
                        prefetchFolderLists(item.data.id);
                      }
                    }}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          if (item.type === "folder") {
                            navigateToFolder(item.data.id, item.data.name);
                          } else {
                            navigateToList(item.data.id);
                          }
                        }}
                        className="flex items-center gap-3 text-left min-w-0"
                      >
                        {item.type === "folder" ? (
                          <Folder
                            className="w-5 h-5 flex-shrink-0"
                            style={{ color: FOLDER_COLOR }}
                          />
                        ) : (
                          <FileSpreadsheet className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-medium truncate group-hover:text-primary transition-colors">
                          {item.data.name}
                        </span>
                      </button>
                    </td>

                    {/* Tags (star icon for favorites) */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleAddToFavorites(item.type, item.data.id, item.data.name)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        <Star className={cn(
                          "w-4 h-4 transition-colors",
                          (item.type === "list" && favoriteListIds.has(item.data.id)) ||
                          (item.type === "folder" && favoriteFolderIds.has(item.data.id))
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground hover:text-yellow-500"
                        )} />
                      </button>
                    </td>

                    {/* Created at */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(item.data.createdAt)}
                    </td>

                    {/* Last opened by me */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.openedAt ? formatDate(item.openedAt) : "—"}
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.type === "list" && (item.data as ListWithCreator).createdById
                        ? userMap.get((item.data as ListWithCreator).createdById!) ?? "—"
                        : "—"}
                    </td>

                    {/* Access */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      Edit
                    </td>

                    {/* Actions - Always visible with border */}
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-8 h-8 flex items-center justify-center rounded border border-border bg-background hover:bg-muted transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openDetails(item)}>
                            <Info className="w-4 h-4 mr-2" />
                            {item.type === "folder" ? "Folder details" : "List details"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingItem({
                                type: item.type,
                                id: item.data.id,
                                name: item.data.name,
                              });
                              setRenameValue(item.data.name);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAddToFavorites(item.type, item.data.id, item.data.name)}>
                            <Star className={cn(
                              "w-4 h-4 mr-2",
                              (item.type === "list" && favoriteListIds.has(item.data.id)) ||
                              (item.type === "folder" && favoriteFolderIds.has(item.data.id))
                                ? "fill-yellow-400 text-yellow-400"
                                : ""
                            )} />
                            {(item.type === "list" && favoriteListIds.has(item.data.id)) ||
                             (item.type === "folder" && favoriteFolderIds.has(item.data.id))
                              ? "Remove from favorites"
                              : "Add to favorites"}
                          </DropdownMenuItem>
                          {item.type === "list" && (
                            <>
                              <DropdownMenuItem
                                onClick={async () => {
                                  toast.info(`Enriching all leads in "${item.data.name}"...`);
                                  try {
                                    const result = await enrichListMutation.mutateAsync({ listId: item.data.id });
                                    toast.success(`Enriched ${result.totalEnriched} leads (${result.totalCredits} credits used)`);
                                  } catch {
                                    toast.error("Enrichment failed");
                                  }
                                }}
                                disabled={enrichListMutation.isPending}
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                {enrichListMutation.isPending ? "Enriching..." : "Enrich All Leads"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setAddToCampaignList({
                                    id: item.data.id,
                                    name: item.data.name,
                                  });
                                  setCampaignSearchQuery("");
                                }}
                              >
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Add to Campaign
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setMovingList({
                                    id: item.data.id,
                                    name: item.data.name,
                                    folderId: item.data.folderId,
                                  });
                                  setFolderSearchQuery("");
                                }}
                              >
                                <FolderInput className="w-4 h-4 mr-2" />
                                Move
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(item.type, item.data.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Sidebar */}
      {detailsItem && (
        <div className="w-80 border-l bg-card p-4 overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {detailsItem.type === "folder" ? (
                <Folder className="w-5 h-5 flex-shrink-0" style={{ color: FOLDER_COLOR }} />
              ) : (
                <FileSpreadsheet className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
              )}
              <span className="font-medium truncate">{detailsItem.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 flex-shrink-0"
              onClick={() => setDetailsItem(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {detailsItem.description || "No description"}
              </p>
            </div>

            {/* Contents (for folders) or Lead count (for lists) */}
            <div className="border-t pt-4">
              {detailsItem.type === "folder" ? (
                <>
                  <Label className="text-sm font-medium mb-2 block">Contents</Label>
                  {subfoldersInFolder.length === 0 && listsInFolder.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This folder is empty</p>
                  ) : (
                    <div className="space-y-2">
                      {subfoldersInFolder.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            navigateToFolder(folder.id, folder.name);
                            setDetailsItem(null);
                          }}
                          className="flex items-center gap-2 w-full p-2 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                        >
                          <Folder className="w-4 h-4" style={{ color: FOLDER_COLOR }} />
                          <span className="text-sm truncate">{folder.name}</span>
                        </button>
                      ))}
                      {listsInFolder.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => navigateToList(list.id)}
                          className="flex items-center gap-2 w-full p-2 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm truncate">{list.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Label className="text-sm font-medium mb-2 block">Details</Label>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lead count</span>
                      <span>{detailsItem.leadCount?.toLocaleString() ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{formatDate(detailsItem.createdAt)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={!!createType} onOpenChange={() => setCreateType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createType === "list" ? "Create New List" : "Create New Folder"}
            </DialogTitle>
            <DialogDescription>
              {createType === "list"
                ? currentFolderId
                  ? `Will be created in "${currentFolderName}"`
                  : "Will be created at root level"
                : currentFolderId
                  ? `Will be created in "${currentFolderName}"`
                  : "Will be created at root level"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={createType === "list" ? "e.g., January Leads" : "e.g., Q1 Campaigns"}
                autoFocus
              />
            </div>
            {createType === "list" && (
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={2}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateType(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createListMutation.isPending || createFolderMutation.isPending}
              >
                {createListMutation.isPending || createFolderMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renamingItem} onOpenChange={() => setRenamingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renamingItem?.type}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenamingItem(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                disabled={updateFolderMutation.isPending || updateListMutation.isPending}
              >
                {updateFolderMutation.isPending || updateListMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move List Dialog */}
      <Dialog open={!!movingList} onOpenChange={() => setMovingList(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Select destination for &quot;{movingList?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search folders..."
                value={folderSearchQuery}
                onChange={(e) => setFolderSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {!folderSearchQuery && (
                <button
                  onClick={() => handleMoveList(null)}
                  disabled={!movingList?.folderId || updateListMutation.isPending}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 border-b",
                    !movingList?.folderId && "bg-primary/5",
                    (!movingList?.folderId || updateListMutation.isPending) && "opacity-50"
                  )}
                >
                  <Folder className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Home</span>
                </button>
              )}
              {filteredFoldersForMove.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {folderSearchQuery ? "No folders match" : "No folders created"}
                </div>
              ) : (
                filteredFoldersForMove.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveList(folder.id)}
                    disabled={folder.id === movingList?.folderId || updateListMutation.isPending}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 border-b last:border-0",
                      folder.id === movingList?.folderId && "bg-primary/5 opacity-50"
                    )}
                  >
                    <Folder className="w-4 h-4" style={{ color: FOLDER_COLOR }} />
                    <span className="text-sm font-medium truncate">{folder.name}</span>
                  </button>
                ))
              )}
            </div>
            {updateListMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Moving...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Campaign Dialog */}
      <Dialog open={!!addToCampaignList} onOpenChange={() => setAddToCampaignList(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Campaign</DialogTitle>
            <DialogDescription>
              Add leads from &quot;{addToCampaignList?.name}&quot; to a campaign
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={campaignSearchQuery}
                onChange={(e) => setCampaignSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filteredCampaignsForAdd.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {campaignSearchQuery ? "No campaigns match" : "No campaigns created"}
                </div>
              ) : (
                filteredCampaignsForAdd.map((campaign: { id: string; name: string }) => (
                  <button
                    key={campaign.id}
                    onClick={() => handleAddToCampaign(campaign.id, campaign.name)}
                    disabled={addListToCampaignMutation.isPending}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 border-b last:border-0"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{campaign.name}</span>
                  </button>
                ))
              )}
            </div>
            {addListToCampaignMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding leads...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
