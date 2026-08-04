"use client";

import {
  User,
  Activity,
  FileText,
  CheckSquare,
  PhoneCall,
  Sparkles,
  Brain,
} from "lucide-react";

export type TabType = "overview" | "activity" | "notes" | "tasks" | "calls" | "coaching" | "intel";

const tabs: { id: TabType; label: string; shortLabel?: string; icon: typeof User }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "calls", label: "Calls", icon: PhoneCall },
  { id: "coaching", label: "Coaching", shortLabel: "Coach", icon: Sparkles },
  { id: "intel", label: "Intel", icon: Brain },
];

interface LeadTabSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function LeadTabSidebar({ activeTab, onTabChange }: LeadTabSidebarProps) {
  return (
    <nav
      className="hidden lg:flex flex-col w-48 flex-shrink-0"
      role="tablist"
      aria-label="Lead details"
    >
      <div className="flex flex-col gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left ${
              activeTab === tab.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <tab.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// Re-export tabs for mobile tab bar
export { tabs };
