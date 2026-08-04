"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PanelLeft, PanelLeftClose, ChevronDown, Plus, Check, LogOut } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { useOrganizations, useSetActiveOrganizationMutation } from "@/hooks/api/useOrganization";
import { toast } from "sonner";

interface SidebarWithTopbarLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  onOpenCreateOrg: () => void;
  canCreateOrg?: boolean;
}

// Map routes to page names
const getPageName = (pathname: string | null): string => {
  if (!pathname) return "Dashboard";

  const routes: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/dashboard/crm": "CRM",
    "/dashboard/campaigns": "Campaigns",
    "/dashboard/leads": "Leads",
    "/dashboard/lists": "Lists",
    "/dashboard/dialer": "Dialer",
    "/dashboard/settings": "Settings",
    "/dashboard/admin": "Admin",
  };

  // Check for exact match first
  if (routes[pathname]) return routes[pathname];

  // Check for partial match (for nested routes)
  for (const [route, name] of Object.entries(routes)) {
    if (pathname.startsWith(route) && route !== "/dashboard") {
      return name;
    }
  }

  return "Dashboard";
};

export function SidebarWithTopbarLayout({ children, onLogout, onOpenCreateOrg, canCreateOrg }: SidebarWithTopbarLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const pageName = getPageName(pathname);

  const { data: session } = useSession();
  const activeOrganization = useActiveOrganization();
  const { data: organizations } = useOrganizations();
  const setActiveMutation = useSetActiveOrganizationMutation();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchOrg = (orgId: string) => {
    setActiveMutation.mutate(
      { organizationId: orgId },
      {
        onSuccess: () => {
          toast.success("Organization switched successfully");
          setUserMenuOpen(false);
        },
        onError: () => {
          toast.error("Failed to switch organization");
        },
      }
    );
  };

  return (
    <div className="h-screen bg-muted/40 p-2 sm:p-3 md:p-4 flex gap-2 sm:gap-3 md:gap-4 overflow-hidden">
      {/* Sidebar */}
      <aside className={`hidden sm:flex bg-card rounded-2xl border shadow-sm flex-col flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56 md:w-60'}`}>
        <Sidebar
          variant="embedded"
          collapsed={sidebarCollapsed}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 min-w-0 pt-16 sm:pt-0 flex flex-col overflow-hidden">
        {/* Content Header with Toggle + Page Name + User Menu */}
        <div className="hidden sm:flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            <span className="text-lg font-medium text-foreground">{pageName}</span>
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 pr-3 hover:bg-muted rounded-lg transition"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-semibold text-sm">
                  {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* User Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                {/* User Info */}
                <div className="p-3 border-b border-border">
                  <div className="font-medium text-foreground">{session?.user?.name || "User"}</div>
                  <div className="text-xs text-muted-foreground">{session?.user?.email}</div>
                </div>

                {/* Organization Section */}
                <div className="p-2 border-b border-border">
                  <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Workspace</p>
                  <div className="max-h-32 overflow-y-auto">
                    {organizations?.data?.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => handleSwitchOrg(org.id)}
                        disabled={setActiveMutation.isPending}
                        className={`
                          w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg
                          hover:bg-muted/50 transition text-left
                          ${org.id === activeOrganization?.data?.id ? "bg-muted" : ""}
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-medium text-xs">
                            {org.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="truncate text-foreground flex-1">{org.name}</span>
                        {org.id === activeOrganization?.data?.id && (
                          <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {canCreateOrg && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenCreateOrg();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 text-sm text-primary hover:bg-muted/50 rounded-lg transition mt-1"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create workspace</span>
                    </button>
                  )}
                </div>

                {/* Sign Out */}
                <div className="p-2">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 w-full bg-card rounded-2xl border shadow-sm p-4 md:p-6 overflow-auto">
          {children}
        </div>
      </main>

      {/* Mobile Sidebar (uses built-in mobile nav) - absolute to not affect flex layout */}
      <div className="sm:hidden absolute">
        <Sidebar />
      </div>
    </div>
  );
}
