/* eslint-disable  @typescript-eslint/no-explicit-any */

"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Shield,
  Kanban,
  Megaphone,
  Users,
  List,
  Phone,
  LogOut,
  Activity,
  Sparkles,
  Bot,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { useSession } from "@/lib/auth-client";
import { useSubscriptionInfo } from "@/hooks/api/useSubscription";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { AppFeature } from "@shared/types/src/stripe";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  feature?: AppFeature;
  proOnly?: boolean;
  experimental?: boolean;
  superadminOnly?: boolean;
}

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/crm", label: "CRM", icon: Kanban },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/lists", label: "Lists", icon: List },
  { href: "/dashboard/dialer", label: "Dialer", icon: Phone },
  { href: "/dashboard/sales-floor", label: "Sales Floor", icon: Activity },
  { href: "/dashboard/coaching", label: "Coaching", icon: Sparkles, feature: "coaching", proOnly: true },
  { href: "/dashboard/agents", label: "AI Agents", icon: Bot, experimental: true },
];

const bottom: NavItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { href: "/dashboard/admin", label: "Admin", icon: Shield },
];

export default function Sidebar({
  variant = "fixed",
  collapsed = false,
  onLogout,
}: {
  variant?: "fixed" | "embedded";
  collapsed?: boolean;
  onLogout?: () => void;
}) {
  const isEmbedded = variant === "embedded";
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as any)?.role === "superadmin";
  const { data: subscriptionData } = useSubscriptionInfo();
  const currentTier = subscriptionData?.tier;
  const isTrialing = subscriptionData?.isTrialing;

  const isFeatureLocked = (item: NavItem): boolean => {
    if (!item.proOnly) return false;
    // Superadmins bypass all feature locks
    if (isSuperAdmin) return false;
    // During trial, grant pro access
    if (isTrialing) return false;
    // If already on pro tier, not locked
    if (currentTier === "pro") return false;
    return true;
  };

  const NavItem = ({
    href,
    label,
    icon: Icon,
    active,
    onClick,
    isCollapsed,
    locked,
  }: {
    href: string;
    label: string;
    icon: any;
    active?: boolean;
    onClick?: () => void;
    isCollapsed?: boolean;
    locked?: boolean;
  }) => {
    if (locked) {
      return (
        <button
          onClick={(e) => {
            e.preventDefault();
            setShowUpgradeModal(true);
          }}
          title={isCollapsed ? `${label} (Pro)` : undefined}
          className={`
            group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 w-full
            text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30
            ${isCollapsed ? "justify-center" : ""}
          `}
        >
          <Icon className="h-4 w-4 flex-shrink-0 opacity-50" />
          {!isCollapsed && (
            <>
              <span className="truncate opacity-60">{label}</span>
              <Lock className="h-3 w-3 ml-auto opacity-40" />
            </>
          )}
        </button>
      );
    }

    return (
      <Link
        href={href}
        onClick={onClick}
        title={isCollapsed ? label : undefined}
        className={`
          group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
          ${active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }
          ${isCollapsed ? "justify-center" : ""}
        `}
      >
        <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
        {!isCollapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  const renderNavItems = (items: NavItem[], options: { isCollapsed?: boolean; onClick?: () => void } = {}) => {
    return items
      .filter((n) => {
        // Experimental and superadminOnly features are superadmin-only
        if (n.experimental || n.superadminOnly) return isSuperAdmin;
        return true;
      })
      .map((n) => (
        <NavItem
          key={n.href}
          href={n.href}
          label={n.label}
          icon={n.icon}
          active={n.href === "/dashboard" ? pathname === n.href : pathname?.startsWith(n.href)}
          isCollapsed={options.isCollapsed}
          onClick={options.onClick}
          locked={isFeatureLocked(n)}
        />
      ));
  };

  // Embedded sidebar (for layouts)
  if (isEmbedded) {
    return (
      <>
        <aside className="w-full h-full px-3 py-4 flex flex-col">
          {/* Header */}
          <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "px-1"}`}>
            <Link href="/dashboard" className="text-foreground hover:opacity-80 transition">
              <Logo collapsed={collapsed} />
            </Link>
          </div>

          {/* Primary nav */}
          <nav className="space-y-1">
            {renderNavItems(nav, { isCollapsed: collapsed })}

            {isSuperAdmin && (
              <>
                <div className="my-3 border-t border-border" />
                {adminNav.map((n) => (
                  <NavItem
                    key={n.href}
                    href={n.href}
                    label={n.label}
                    icon={n.icon}
                    active={pathname?.startsWith(n.href)}
                    isCollapsed={collapsed}
                  />
                ))}
              </>
            )}
          </nav>

          {/* Settings - with spacing above */}
          <div className="mt-6">
            {bottom.map((n) => (
              <NavItem
                key={n.href}
                href={n.href}
                label={n.label}
                icon={n.icon}
                active={pathname?.startsWith(n.href)}
                isCollapsed={collapsed}
              />
            ))}
          </div>
        </aside>

        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
      </>
    );
  }

  // Fixed sidebar (standalone)
  return (
    <>
      {/* Mobile Top Nav */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard">
            <Logo variant="full" />
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="relative w-8 h-8 flex flex-col items-center justify-center gap-1.5"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <span
              className={`block w-5 h-0.5 bg-foreground transition-all duration-300 ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`block w-5 h-0.5 bg-foreground transition-all duration-300 ${mobileMenuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-5 h-0.5 bg-foreground transition-all duration-300 ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <div
          className={`overflow-hidden transition-all duration-300 ${mobileMenuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"}`}
        >
          <nav className="px-4 py-4 space-y-1 border-t border-border bg-background">
            {renderNavItems(nav, { onClick: () => setMobileMenuOpen(false) })}

            {isSuperAdmin &&
              adminNav.map((n) => (
                <NavItem
                  key={n.href}
                  href={n.href}
                  label={n.label}
                  icon={n.icon}
                  active={pathname?.startsWith(n.href)}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}

            <div className="pt-4 mt-4 border-t border-border space-y-1">
              {bottom.map((n) => (
                <NavItem
                  key={n.href}
                  href={n.href}
                  label={n.label}
                  icon={n.icon}
                  active={pathname?.startsWith(n.href)}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}
            </div>

            {/* Mobile User Section */}
            <div className="pt-4 mt-4 border-t border-border">
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold text-sm">
                    {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {session?.user?.name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session?.user?.email}
                  </p>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={`
          ${isEmbedded ? "w-full h-full" : "fixed top-3 left-3 bottom-3 z-20 w-56 border border-border bg-card rounded-2xl shadow-sm"}
          px-3 py-4
          hidden sm:flex
          flex-col
        `}
      >
        {/* Header */}
        <div className="mb-6 px-1">
          <Link href="/dashboard" className="text-foreground hover:opacity-80 transition">
            <Logo variant="full" />
          </Link>
        </div>

        {/* Primary nav */}
        <nav className="space-y-1">
          {renderNavItems(nav)}

          {isSuperAdmin && (
            <>
              <div className="my-3 border-t border-border" />
              {adminNav.map((n) => (
                <NavItem
                  key={n.href}
                  href={n.href}
                  label={n.label}
                  icon={n.icon}
                  active={pathname?.startsWith(n.href)}
                />
              ))}
            </>
          )}
        </nav>

        {/* Settings - with spacing above */}
        <div className="mt-6">
          {bottom.map((n) => (
            <NavItem
              key={n.href}
              href={n.href}
              label={n.label}
              icon={n.icon}
              active={pathname?.startsWith(n.href)}
            />
          ))}
        </div>
      </aside>

      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
    </>
  );
}
