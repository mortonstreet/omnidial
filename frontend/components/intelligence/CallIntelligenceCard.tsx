"use client";

import { useState } from "react";
import {
  Brain,
  User,
  Target,
  AlertTriangle,
  Cpu,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import type { CallIntelligenceRecord } from "@shared/types/src/requests/callIntelligence";

interface CallIntelligenceCardProps {
  intelligence: CallIntelligenceRecord;
}

function RoleBadge({ role }: { role: string }) {
  const roleColors: Record<string, string> = {
    decision_maker: "bg-green-500/10 text-green-600",
    influencer: "bg-blue-500/10 text-blue-600",
    gatekeeper: "bg-orange-500/10 text-orange-600",
    end_user: "bg-purple-500/10 text-purple-600",
    unknown: "bg-muted text-muted-foreground",
  };

  const roleLabels: Record<string, string> = {
    decision_maker: "Decision Maker",
    influencer: "Influencer",
    gatekeeper: "Gatekeeper",
    end_user: "End User",
    unknown: "Unknown Role",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleColors[role] || roleColors.unknown}`}
    >
      {roleLabels[role] || role}
    </span>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  items,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!items || items.length === 0) return null;

  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 pl-6">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-muted-foreground/50 mt-1.5 w-1 h-1 rounded-full bg-current flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CallIntelligenceCard({ intelligence }: CallIntelligenceCardProps) {
  const dm = intelligence.decisionMaker;
  const hasDM = dm && (dm.name || dm.title);

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Call Intelligence</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {new Date(intelligence.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Decision Maker */}
      {hasDM && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
          <User className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {dm.name && (
                <span className="text-sm font-medium text-foreground">{dm.name}</span>
              )}
              {dm.role && <RoleBadge role={dm.role} />}
            </div>
            {dm.title && (
              <p className="text-xs text-muted-foreground mt-0.5">{dm.title}</p>
            )}
            {dm.notes && (
              <p className="text-xs text-muted-foreground mt-1">{dm.notes}</p>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {intelligence.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {intelligence.summary}
        </p>
      )}

      {/* Collapsible Sections */}
      <CollapsibleSection
        title="Pain Points"
        icon={AlertTriangle}
        items={intelligence.painPoints}
        defaultOpen={true}
      />
      <CollapsibleSection
        title="Current Strategies"
        icon={Target}
        items={intelligence.currentStrategies}
      />
      <CollapsibleSection
        title="Tech Stack"
        icon={Cpu}
        items={intelligence.techStack}
      />
      <CollapsibleSection
        title="Key Talking Points"
        icon={MessageSquare}
        items={intelligence.talkingPoints}
      />

      {/* Footer */}
      <div className="border-t border-border pt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Model: {intelligence.modelUsed}
        </span>
        <span className="text-xs text-muted-foreground">
          {(intelligence.analysisTimeMs / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
