"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Phone,
  Kanban,
  MoreHorizontal,
  Settings,
  Shield,
  Megaphone,
  Users,
  List,
  Activity,
  Sparkles,
  LogOut,
  ChevronDown,
  Plus,
  Check,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Logo } from "@/components/brand";
import { useSession, useActiveOrganization } from "@/lib/auth-client";
import { useOrganizations, useSetActiveOrganizationMutation } from "@/hooks/api/useOrganization";
import { toast } from "sonner";

interface MobileNavigationProps {
  onLogout: () => void;
  onOpenCreateOrg: () => void;
  canCreateOrg?: boolean;
}

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/dialer", label: "Dialer", icon: Phone },
  { href: "/dashboard/crm", label: "CRM", icon: Kanban },
];

const fullNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/crm", label: "CRM", icon: Kanban },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/lists", label: "Lists", icon: List },
  { href: "/dashboard/dialer", label: "Dialer", icon: Phone },
  { href: "/dashboard/sales-floor", label: "Sales Floor", icon: Activity },
  { href: "/dashboard/coaching", label: "Coaching", icon: Sparkles },
];

const bottomNav = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { href: "/dashboard/admin", label: "Admin", icon: Shield },
];

export function MobileNavigation({ onLogout, onOpenCreateOrg, canCreateOrg }: MobileNavigationProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [orgSelectorOpen, setOrgSelectorOpen] = useState(false);
  const pathname = usePathname();

  const { data: session } = useSession();
  const activeOrganization = useActiveOrganization();
  const { data: organizations } = useOrganizations();
  const setActiveMutation = useSetActiveOrganizationMutation();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSuperAdmin = (session?.user as any)?.role === "superadmin";

  const handleSwitchOrg = (orgId: string) => {
    setActiveMutation.mutate(
      { organizationId: orgId },
      {
        onSuccess: () => {
          toast.success("Organization switched successfully");
          setOrgSelectorOpen(false);
        },
        onError: () => {
          toast.error("Failed to switch organization");
        },
      }
    );
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Fixed Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                isActive(item.href)
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setSheetOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
              sheetOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Logo collapsed />
              <span>Menu</span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Full Navigation */}
            <nav className="space-y-1 px-2">
              {fullNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSheetOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}

              {isSuperAdmin && (
                <>
                  <div className="my-3 border-t border-border" />
                  {adminNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  ))}
                </>
              )}

              <div className="my-3 border-t border-border" />
              {bottomNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSheetOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* User Section */}
            <div className="mt-6 px-2 border-t border-border pt-4">
              {/* User Info */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold">
                    {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {session?.user?.name || "User"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {session?.user?.email}
                  </p>
                </div>
              </div>

              {/* Organization Selector */}
              <div className="px-4 mt-3">
                <button
                  onClick={() => setOrgSelectorOpen(!orgSelectorOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-medium text-xs">
                        {activeOrganization?.data?.name?.charAt(0).toUpperCase() || "O"}
                      </span>
                    </div>
                    <span className="text-sm font-medium truncate">
                      {activeOrganization?.data?.name || "Select workspace"}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${orgSelectorOpen ? "rotate-180" : ""}`} />
                </button>

                {orgSelectorOpen && (
                  <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
                    <div className="max-h-40 overflow-y-auto">
                      {organizations?.data?.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => handleSwitchOrg(org.id)}
                          disabled={setActiveMutation.isPending}
                          className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted transition ${
                            org.id === activeOrganization?.data?.id ? "bg-muted" : ""
                          }`}
                        >
                          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-medium text-xs">
                              {org.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="flex-1 truncate text-sm">{org.name}</span>
                          {org.id === activeOrganization?.data?.id && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                    {canCreateOrg && (
                      <button
                        onClick={() => {
                          setSheetOpen(false);
                          setOrgSelectorOpen(false);
                          onOpenCreateOrg();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-primary hover:bg-muted border-t border-border"
                      >
                        <Plus className="w-4 h-4" />
                        Create workspace
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sign Out */}
              <button
                onClick={() => {
                  setSheetOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 mt-3 text-destructive hover:bg-destructive/10 rounded-xl transition"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
