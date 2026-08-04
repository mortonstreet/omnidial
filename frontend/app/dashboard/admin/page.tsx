"use client";

import { useState } from "react";
import { Page } from "@/components/dashboard/Page";
import Card from "@/components/ui/card";
import { Card as BaseCard } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import Modal from "@/components/ui/modal";
import {
  useAdminStats,
  useAdminUsers,
  useAdminOrganizations,
  useImpersonateUser,
  useAddOrganizationCredits,
  useDeleteUser,
  useDeleteOrganization,
  useReassignUser,
  useCreateOrganization,
  useRemoveUserFromOrganization,
  useOrganizationMembers,
  useAdminSwitchOrg,
} from "@/hooks/api/useAdmin";
import { useSession } from "@/lib/auth-client";
import { Users, Building2, Search, ChevronLeft, ChevronRight, Plus, Trash2, UserPlus, Eye, FileText, ArrowRightLeft, Phone, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminUser, AdminOrganization } from "@shared/types/src";
import { LogsTab } from "@/components/admin/LogsTab";
import {
  useAdminPhoneProvisioning,
  useAdminProvisionOrganization,
  useAdminMarkMainAccount,
  useAdminReleaseNumber,
} from "@/hooks/api/usePhoneProvisioning";

type Tab = "users" | "organizations" | "logs" | "phone-provisioning";

function Pagination({ 
  page, 
  totalPages, 
  onPageChange,
  total,
  limit,
}: { 
  page: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
  total: number;
  limit: number;
}) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-sm text-muted-foreground">
        Showing {start} to {end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
        <span className="text-sm text-foreground px-2">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      </div>
    </div>
  );
}

function SearchBar({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder: string;
}) {
  return (
    <div className="relative mb-4">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 text-sm text-foreground placeholder-muted-foreground bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
      />
    </div>
  );
}

function PhoneProvisioningTab() {
  const { data, isLoading } = useAdminPhoneProvisioning();
  const provisionMutation = useAdminProvisionOrganization();
  const markMainMutation = useAdminMarkMainAccount();
  const releaseMutation = useAdminReleaseNumber();
  const records = data?.data || [];

  if (isLoading) {
    return (
      <BaseCard>
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      </BaseCard>
    );
  }

  const handleProvision = (orgId: string) => {
    provisionMutation.mutate(orgId, {
      onSuccess: () => toast.success("Provisioning started"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to provision"),
    });
  };

  const handleReleaseNumber = (orgId: string) => {
    if (!confirm("Are you sure you want to release this phone number? The subaccount infrastructure will remain intact.")) {
      return;
    }
    releaseMutation.mutate(orgId, {
      onSuccess: () => toast.success("Phone number released"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to release number"),
    });
  };

  const handleMarkMainAccount = (orgId: string) => {
    markMainMutation.mutate(orgId, {
      onSuccess: () => toast.success("Marked as main account"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to mark"),
    });
  };

  return (
    <BaseCard>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Organization</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Subaccount SID</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Phone Number</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Verified</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Provisioned</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No organizations found.
                </td>
              </tr>
            )}
            {records.map((record) => (
              <tr key={record.organizationId} className="border-b border-border hover:bg-muted/30">
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {record.organizationName}
                    {record.usesMainAccount && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500">
                        Main Account
                      </span>
                    )}
                    {record.managedBySuperadmin && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-500">
                        Admin Managed
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-xs">
                  {record.twilioSubaccountSid ? (
                    <a
                      href="https://portal.telnyx.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {record.twilioSubaccountSid}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-mono">{record.phoneNumber || "-"}</td>
                <td className="px-4 py-3 text-sm capitalize">{record.numberType || "-"}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      record.provisioningStatus === "active"
                        ? "bg-green-500/10 text-green-500"
                        : record.provisioningStatus === "failed"
                        ? "bg-red-500/10 text-red-500"
                        : record.provisioningStatus === "not_provisioned"
                        ? "bg-gray-500/10 text-gray-500"
                        : "bg-yellow-500/10 text-yellow-500"
                    }`}
                  >
                    {record.provisioningStatus === "not_provisioned" ? "Not Provisioned" : record.provisioningStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {record.callerIdVerified ? "Yes" : "No"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {record.provisionedAt
                    ? new Date(record.provisionedAt).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-1">
                    {(record.provisioningStatus === "not_provisioned" || record.provisioningStatus === "failed") && !record.usesMainAccount && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProvision(record.organizationId)}
                        disabled={provisionMutation.isPending}
                        className="text-xs"
                      >
                        {record.provisioningStatus === "failed" ? "Retry" : "Provision"}
                      </Button>
                    )}
                    {record.provisioningStatus === "active" && record.phoneNumber && !record.usesMainAccount && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReleaseNumber(record.organizationId)}
                        disabled={releaseMutation.isPending}
                        className="text-xs text-red-500"
                      >
                        Release
                      </Button>
                    )}
                    {!record.usesMainAccount && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkMainAccount(record.organizationId)}
                        disabled={markMainMutation.isPending}
                        className="text-xs text-blue-500"
                      >
                        Flag Main
                      </Button>
                    )}
                    {record.usesMainAccount && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkMainAccount(record.organizationId)}
                        disabled={markMainMutation.isPending}
                        className="text-xs text-blue-500"
                      >
                        Sync Config
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseCard>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const { data: session } = useSession();

  // Search states
  const [usersSearch, setUsersSearch] = useState("");
  const [orgsSearch, setOrgsSearch] = useState("");

  // Add Credits Modal
  const [isAddCreditsModalOpen, setIsAddCreditsModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("");
  const [creditsReason, setCreditsReason] = useState("");

  // Delete User Modal
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Delete Organization Modal
  const [isDeleteOrgModalOpen, setIsDeleteOrgModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<AdminOrganization | null>(null);

  // Reassign User Modal
  const [isReassignUserModalOpen, setIsReassignUserModalOpen] = useState(false);
  const [userToReassign, setUserToReassign] = useState<AdminUser | null>(null);
  const [reassignTargetOrgId, setReassignTargetOrgId] = useState("");
  const [reassignRole, setReassignRole] = useState("member");

  // Create Organization Modal
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");

  // View Members Modal
  const [isViewMembersModalOpen, setIsViewMembersModalOpen] = useState(false);
  const [viewMembersOrgId, setViewMembersOrgId] = useState<string | null>(null);

  // Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [orgsPage, setOrgsPage] = useState(1);

  const LIMIT = 20;

  // Reset page when search changes
  const handleUsersSearchChange = (search: string) => {
    setUsersSearch(search);
    setUsersPage(1);
  };

  const handleOrgsSearchChange = (search: string) => {
    setOrgsSearch(search);
    setOrgsPage(1);
  };

  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: usersData, isLoading: usersLoading } = useAdminUsers({
    page: usersPage,
    limit: LIMIT,
    search: usersSearch || undefined
  });
  const { data: orgsData, isLoading: orgsLoading } = useAdminOrganizations({
    page: orgsPage,
    limit: LIMIT,
    search: orgsSearch || undefined
  });
  const { data: membersData, isLoading: membersLoading } = useOrganizationMembers(viewMembersOrgId);

  const impersonateMutation = useImpersonateUser();
  const addCreditsMutation = useAddOrganizationCredits();
  const deleteUserMutation = useDeleteUser();
  const deleteOrgMutation = useDeleteOrganization();
  const reassignUserMutation = useReassignUser();
  const createOrgMutation = useCreateOrganization();
  const removeUserFromOrgMutation = useRemoveUserFromOrganization();
  const switchOrgMutation = useAdminSwitchOrg();
  const router = useRouter();

  const handleOpenAddCreditsModal = (org: AdminOrganization) => {
    setSelectedOrg({ id: org.id, name: org.name });
    setCreditsAmount("");
    setCreditsReason("");
    setIsAddCreditsModalOpen(true);
  };

  const handleAddCredits = () => {
    if (!selectedOrg) return;
    const amount = parseInt(creditsAmount, 10);
    if (isNaN(amount) || amount < 1) {
      toast.error("Please enter a valid amount");
      return;
    }

    addCreditsMutation.mutate(
      { organizationId: selectedOrg.id, amount, reason: creditsReason || undefined },
      {
        onSuccess: (result) => {
          toast.success(`Added ${amount} credits to ${selectedOrg.name}. New balance: ${result.newBalance}`);
          setIsAddCreditsModalOpen(false);
          setSelectedOrg(null);
        },
        onError: () => {
          toast.error("Failed to add credits");
        },
      }
    );
  };

  const handleImpersonate = (userId: string, userName: string) => {
    impersonateMutation.mutate(userId, {
      onSuccess: (result) => {
        if (result.error) {
          toast.error(result.error.message || "Failed to impersonate user");
        } else {
          toast.success(`Now impersonating ${userName}`);
          window.location.href = "/dashboard";
        }
      },
      onError: () => {
        toast.error("Failed to impersonate user");
      },
    });
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id, {
      onSuccess: () => {
        toast.success(`User ${selectedUser.email} deleted`);
        setIsDeleteUserModalOpen(false);
        setSelectedUser(null);
      },
      onError: (error: Error) => {
        toast.error(error.message || "Failed to delete user");
      },
    });
  };

  const handleDeleteOrganization = () => {
    if (!orgToDelete) return;
    deleteOrgMutation.mutate(orgToDelete.id, {
      onSuccess: () => {
        toast.success(`Organization ${orgToDelete.name} deleted`);
        setIsDeleteOrgModalOpen(false);
        setOrgToDelete(null);
      },
      onError: (error: Error) => {
        toast.error(error.message || "Failed to delete organization");
      },
    });
  };

  const handleReassignUser = () => {
    if (!userToReassign || !reassignTargetOrgId) return;
    reassignUserMutation.mutate(
      {
        userId: userToReassign.id,
        toOrganizationId: reassignTargetOrgId,
        role: reassignRole,
      },
      {
        onSuccess: () => {
          toast.success(`User ${userToReassign.email} reassigned successfully`);
          setIsReassignUserModalOpen(false);
          setUserToReassign(null);
          setReassignTargetOrgId("");
          setReassignRole("member");
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to reassign user");
        },
      }
    );
  };

  const handleCreateOrganization = () => {
    if (!newOrgName || !newOrgSlug) return;
    createOrgMutation.mutate(
      { name: newOrgName, slug: newOrgSlug },
      {
        onSuccess: () => {
          toast.success(`Organization "${newOrgName}" created`);
          setIsCreateOrgModalOpen(false);
          setNewOrgName("");
          setNewOrgSlug("");
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to create organization");
        },
      }
    );
  };

  const handleRemoveUserFromOrg = (orgId: string, userId: string, userEmail: string) => {
    removeUserFromOrgMutation.mutate(
      { organizationId: orgId, userId },
      {
        onSuccess: () => {
          toast.success(`User ${userEmail} removed from organization`);
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to remove user");
        },
      }
    );
  };

  const handleSwitchOrg = (org: AdminOrganization) => {
    switchOrgMutation.mutate(org.id, {
      onSuccess: (result) => {
        toast.success(`Switched to ${result.organizationName}`);
        router.push("/dashboard");
      },
      onError: (error: Error) => {
        toast.error(error.message || "Failed to switch organization");
      },
    });
  };

  const openDeleteUserModal = (user: AdminUser) => {
    setSelectedUser(user);
    setIsDeleteUserModalOpen(true);
  };

  const openDeleteOrgModal = (org: AdminOrganization) => {
    setOrgToDelete(org);
    setIsDeleteOrgModalOpen(true);
  };

  const openReassignUserModal = (user: AdminUser) => {
    setUserToReassign(user);
    setReassignTargetOrgId("");
    setReassignRole("member");
    setIsReassignUserModalOpen(true);
  };

  const openViewMembersModal = (org: AdminOrganization) => {
    setViewMembersOrgId(org.id);
    setIsViewMembersModalOpen(true);
  };

  // Auto-generate slug from name
  const handleNewOrgNameChange = (name: string) => {
    setNewOrgName(name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setNewOrgSlug(slug);
  };

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "organizations", label: "Organizations", icon: Building2 },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "phone-provisioning", label: "Phone Numbers", icon: Phone },
  ];

  return (
    <Page title="Admin" subtitle="Manage users, organizations, and interviews">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-semibold text-foreground">
                {statsLoading ? "..." : stats?.users ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Organizations</p>
              <p className="text-2xl font-semibold text-foreground">
                {statsLoading ? "..." : stats?.organizations ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition
                ${activeTab === tab.id
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "users" && (
        <Card title={stats ? `Users (${stats.users} users across ${stats.organizations} organizations)` : "Users"}>
          <SearchBar 
            value={usersSearch} 
            onChange={handleUsersSearchChange} 
            placeholder="Search by email, name, or organization..."
          />
          {usersLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-foreground">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Organizations</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Verified</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Created</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData?.data?.map((user: AdminUser) => (
                      <tr key={user.id} className="border-b border-border/50 hover:bg-muted">
                        <td className="py-3 px-4 text-foreground">{user.email}</td>
                        <td className="py-3 px-4 text-muted-foreground">{user.name || "-"}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {user.role === "superadmin" ? (
                            <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">
                              All
                            </span>
                          ) : user.organizations.length > 0
                            ? user.organizations.join(", ")
                            : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                            user.emailVerified 
                              ? "bg-green-100 text-green-700" 
                              : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {user.emailVerified ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                            user.role === "superadmin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {user.role === "superadmin" ? "Super Admin" : "User"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {user.id !== session?.user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleImpersonate(user.id, user.name || user.email)}
                                  disabled={impersonateMutation.isPending}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Impersonate User
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openReassignUserModal(user)}>
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Reassign to Org
                                </DropdownMenuItem>
                                {user.role !== "superadmin" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => openDeleteUserModal(user)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete User
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {usersData?.pagination && usersData.pagination.totalPages > 1 && (
                <Pagination
                  page={usersData.pagination.page}
                  totalPages={usersData.pagination.totalPages}
                  total={usersData.pagination.total}
                  limit={usersData.pagination.limit}
                  onPageChange={setUsersPage}
                />
              )}
            </>
          )}
        </Card>
      )}

      {activeTab === "organizations" && (
        <Card title="Organizations">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 mr-4">
              <SearchBar
                value={orgsSearch}
                onChange={handleOrgsSearchChange}
                placeholder="Search by name or slug..."
              />
            </div>
            <Button
              onClick={() => setIsCreateOrgModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Organization
            </Button>
          </div>
          {orgsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading organizations...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-foreground">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Slug</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Members</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Credits</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Created</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgsData?.data?.map((org: AdminOrganization) => (
                      <tr key={org.id} className="border-b border-border/50 hover:bg-muted">
                        <td className="py-3 px-4 text-foreground font-medium">
                          <div className="flex items-center gap-2">
                            {org.name}
                            {org.managedBySuperadmin && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-500">
                                Admin Managed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{org.slug}</td>
                        <td className="py-3 px-4 text-muted-foreground">{org.memberCount}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            org.creditBalance > 0 
                              ? "bg-green-100 text-green-700" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {org.creditBalance}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleSwitchOrg(org)}
                                disabled={switchOrgMutation.isPending}
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Switch to Org
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openViewMembersModal(org)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Members
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenAddCreditsModal(org)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Credits
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => openDeleteOrgModal(org)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Organization
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {orgsData?.pagination && orgsData.pagination.totalPages > 1 && (
                <Pagination
                  page={orgsData.pagination.page}
                  totalPages={orgsData.pagination.totalPages}
                  total={orgsData.pagination.total}
                  limit={orgsData.pagination.limit}
                  onPageChange={setOrgsPage}
                />
              )}
            </>
          )}
        </Card>
      )}

      {activeTab === "logs" && (
        <LogsTab />
      )}

      {activeTab === "phone-provisioning" && (
        <PhoneProvisioningTab />
      )}

      {/* Add Credits Modal */}
      <Modal
        isOpen={isAddCreditsModalOpen}
        onClose={() => {
          setIsAddCreditsModalOpen(false);
          setSelectedOrg(null);
        }}
        title="Add Credits"
        subtitle={selectedOrg ? `Add interview credits to ${selectedOrg.name}` : undefined}
      >
        <div className="space-y-4">
          <FormInput
            label="Number of Credits"
            type="number"
            min={1}
            value={creditsAmount}
            onChange={(e) => setCreditsAmount(e.target.value)}
            placeholder="Enter amount"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              Reason (optional)
            </label>
            <textarea
              value={creditsReason}
              onChange={(e) => setCreditsReason(e.target.value)}
              placeholder="e.g., Promotional credits, Customer support adjustment..."
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground outline-none transition focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] resize-none placeholder:text-muted-foreground"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCreditsModalOpen(false);
                setSelectedOrg(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCredits}
              disabled={addCreditsMutation.isPending || !creditsAmount}
            >
              Add Credits
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        isOpen={isDeleteUserModalOpen}
        onClose={() => {
          setIsDeleteUserModalOpen(false);
          setSelectedUser(null);
        }}
        title="Delete User"
        subtitle={selectedUser ? `Are you sure you want to delete ${selectedUser.email}?` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The user will be permanently removed from the system.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteUserModalOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Organization Modal */}
      <Modal
        isOpen={isDeleteOrgModalOpen}
        onClose={() => {
          setIsDeleteOrgModalOpen(false);
          setOrgToDelete(null);
        }}
        title="Delete Organization"
        subtitle={orgToDelete ? `Are you sure you want to delete "${orgToDelete.name}"?` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All data associated with this organization will be permanently deleted.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOrgModalOpen(false);
                setOrgToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrganization}
              disabled={deleteOrgMutation.isPending}
            >
              Delete Organization
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reassign User Modal */}
      <Modal
        isOpen={isReassignUserModalOpen}
        onClose={() => {
          setIsReassignUserModalOpen(false);
          setUserToReassign(null);
        }}
        title="Reassign User"
        subtitle={userToReassign ? `Add ${userToReassign.email} to an organization` : undefined}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              Target Organization
            </label>
            <select
              value={reassignTargetOrgId}
              onChange={(e) => setReassignTargetOrgId(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground outline-none transition focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">Select an organization...</option>
              {orgsData?.data?.map((org: AdminOrganization) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              Role
            </label>
            <select
              value={reassignRole}
              onChange={(e) => setReassignRole(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground outline-none transition focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsReassignUserModalOpen(false);
                setUserToReassign(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReassignUser}
              disabled={reassignUserMutation.isPending || !reassignTargetOrgId}
            >
              Reassign User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Organization Modal */}
      <Modal
        isOpen={isCreateOrgModalOpen}
        onClose={() => {
          setIsCreateOrgModalOpen(false);
          setNewOrgName("");
          setNewOrgSlug("");
        }}
        title="Create Organization"
        subtitle="Create a new organization"
      >
        <div className="space-y-4">
          <FormInput
            label="Organization Name"
            value={newOrgName}
            onChange={(e) => handleNewOrgNameChange(e.target.value)}
            placeholder="My Company"
            required
          />
          <FormInput
            label="Slug"
            value={newOrgSlug}
            onChange={(e) => setNewOrgSlug(e.target.value)}
            placeholder="my-company"
            required
          />
          <p className="text-xs text-muted-foreground">
            Slug must be lowercase letters, numbers, and hyphens only.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOrgModalOpen(false);
                setNewOrgName("");
                setNewOrgSlug("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrganization}
              disabled={createOrgMutation.isPending || !newOrgName || !newOrgSlug}
            >
              Create Organization
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Members Modal */}
      <Modal
        isOpen={isViewMembersModalOpen}
        onClose={() => {
          setIsViewMembersModalOpen(false);
          setViewMembersOrgId(null);
        }}
        title="Organization Members"
        subtitle={membersData?.organizationName ? `Members of ${membersData.organizationName}` : undefined}
      >
        <div className="space-y-4">
          {membersLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading members...</div>
          ) : membersData?.members?.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No members found</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {membersData?.members?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full mt-1 ${
                      member.role === "owner"
                        ? "bg-purple-100 text-purple-700"
                        : member.role === "admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {member.role}
                    </span>
                  </div>
                  {member.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveUserFromOrg(viewMembersOrgId!, member.userId, member.email)}
                      disabled={removeUserFromOrgMutation.isPending}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Remove from organization"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsViewMembersModalOpen(false);
                setViewMembersOrgId(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

    </Page>
  );
}
