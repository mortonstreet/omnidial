"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AIBusinessContext } from "@/hooks/api/useLeads";

interface CompanySummaryCardProps {
  summary: string | null;
  companyName: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  /** Compact mode for dialer view - shows less content by default */
  compact?: boolean;
  className?: string;
  /** Structured data (new format) - takes priority over markdown parsing */
  structuredData?: {
    overview?: string | null;
    talkingPoints?: string[] | null;
    businessContext?: AIBusinessContext | null;
  };
}

/**
 * Reusable component for displaying AI-generated company summaries
 * with proper markdown rendering and collapsible sections.
 */
export function CompanySummaryCard({
  summary,
  companyName,
  isGenerating,
  onGenerate,
  onRegenerate,
  compact = false,
  className,
  structuredData,
}: CompanySummaryCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(compact ? [] : ["overview", "talking-points"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // No summary yet - show generate button
  if (!summary) {
    return (
      <div className={cn("text-center py-4", className)}>
        <p className="text-sm text-muted-foreground mb-3">
          Generate an AI summary about {companyName}
        </p>
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          variant="outline"
          size={compact ? "sm" : "default"}
          className={compact ? "" : "h-11 touch-manipulation"}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Researching...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Summary
            </>
          )}
        </Button>
      </div>
    );
  }

  // No info available state
  if (summary === "NO_INFO_AVAILABLE") {
    return (
      <div className={cn("text-center py-4", className)}>
        <p className="text-sm text-muted-foreground mb-3">
          No company information available for {companyName}
        </p>
        <Button
          onClick={onRegenerate}
          disabled={isGenerating}
          variant="outline"
          size={compact ? "sm" : "default"}
          className={compact ? "" : "h-11 touch-manipulation"}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </>
          )}
        </Button>
      </div>
    );
  }

  // Use structured data if available, otherwise parse the markdown summary
  const sections = structuredData?.overview
    ? convertStructuredToSections(structuredData)
    : parseSummaryIntoSections(summary);

  if (compact) {
    // Compact mode for dialer - show structured sections with regenerate button
    return (
      <div className={cn("space-y-2", className)}>
        {sections.map((section) => (
          <CompactSection
            key={section.id}
            section={section}
            isExpanded={expandedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
        {/* Regenerate button for compact mode */}
        <div className="pt-2 border-t border-border">
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 rounded-md transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                Regenerate Summary
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Full mode - render with markdown and regenerate button
  return (
    <div className={cn("space-y-3", className)}>
      {sections.map((section) => (
        <FullSection
          key={section.id}
          section={section}
          isExpanded={expandedSections.has(section.id)}
          onToggle={() => toggleSection(section.id)}
        />
      ))}
      {/* Regenerate button for full mode */}
      <div className="pt-3 border-t border-border">
        <Button
          onClick={onRegenerate}
          disabled={isGenerating}
          variant="outline"
          size="sm"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Summary
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface Section {
  id: string;
  title: string;
  content: string;
  priority: number; // Lower = more important, shown first
}

/**
 * Convert structured data from API to display sections
 */
function convertStructuredToSections(data: {
  overview?: string | null;
  talkingPoints?: string[] | null;
  businessContext?: AIBusinessContext | null;
}): Section[] {
  const sections: Section[] = [];

  // Overview section
  if (data.overview) {
    sections.push({
      id: "company-overview",
      title: "Company Overview",
      content: data.overview,
      priority: 1,
    });
  }

  // Products/Services from business context
  const ctx = data.businessContext;
  if (ctx?.products && ctx.products.length > 0) {
    sections.push({
      id: "products-services",
      title: "Key Products/Services",
      content: ctx.products.map((p) => `• ${p}`).join("\n"),
      priority: 2,
    });
  }

  // Target Customers
  if (ctx?.targetCustomers) {
    sections.push({
      id: "target-customers",
      title: "Target Customers",
      content: `• ${ctx.targetCustomers}`,
      priority: 3,
    });
  }

  // Business Context (founded, size, funding, news)
  const contextLines: string[] = [];
  if (ctx?.founded) contextLines.push(`• Founded: ${ctx.founded}`);
  if (ctx?.size) contextLines.push(`• Size: ${ctx.size}`);
  if (ctx?.funding) contextLines.push(`• Funding: ${ctx.funding}`);
  if (ctx?.recentNews) contextLines.push(`• Recent News: ${ctx.recentNews}`);
  if (contextLines.length > 0) {
    sections.push({
      id: "business-context",
      title: "Business Context",
      content: contextLines.join("\n"),
      priority: 4,
    });
  }

  // Sales Talking Points
  if (data.talkingPoints && data.talkingPoints.length > 0) {
    sections.push({
      id: "sales-talking-points",
      title: "Sales Talking Points",
      content: data.talkingPoints.map((p, i) => `${i + 1}. ${p}`).join("\n"),
      priority: 5,
    });
  }

  return sections.sort((a, b) => a.priority - b.priority);
}

/**
 * Parse AI summary text into structured sections based on headers
 */
function parseSummaryIntoSections(summary: string): Section[] {
  const sections: Section[] = [];
  const lines = summary.split("\n");

  let currentSection: Section | null = null;
  let contentLines: string[] = [];

  // Priority mapping for section types
  const sectionPriority: Record<string, number> = {
    "company overview": 1,
    "overview": 1,
    "key products/services": 2,
    "products & services": 2,
    "products/services": 2,
    "target customers": 3,
    "customers": 3,
    "business context": 4,
    "context": 4,
    "sales talking points": 5,
    "talking points": 5,
  };

  const getSectionId = (title: string): string => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  };

  const getPriority = (title: string): number => {
    const lowerTitle = title.toLowerCase();
    for (const [key, priority] of Object.entries(sectionPriority)) {
      if (lowerTitle.includes(key)) {
        return priority;
      }
    }
    return 99; // Unknown sections go last
  };

  const finishSection = () => {
    if (currentSection && contentLines.length > 0) {
      currentSection.content = contentLines.join("\n").trim();
      if (currentSection.content) {
        sections.push(currentSection);
      }
    }
    contentLines = [];
  };

  for (const line of lines) {
    // Check for section headers (markdown bold or plain headers)
    const headerMatch = line.match(/^\*\*([A-Z][A-Z\s\/&]+)\*\*$/i) ||
                       line.match(/^##?\s*(.+)$/);

    if (headerMatch) {
      finishSection();
      const title = headerMatch[1].trim();
      currentSection = {
        id: getSectionId(title),
        title: title,
        content: "",
        priority: getPriority(title),
      };
    } else if (currentSection) {
      // Skip the divider lines
      if (line.trim() !== "---") {
        contentLines.push(line);
      }
    } else {
      // Content before any header - treat as overview
      if (line.trim()) {
        if (!currentSection) {
          currentSection = {
            id: "overview",
            title: "Overview",
            content: "",
            priority: 0,
          };
        }
        contentLines.push(line);
      }
    }
  }

  finishSection();

  // If no sections were parsed, treat the whole thing as a single overview
  if (sections.length === 0 && summary.trim()) {
    sections.push({
      id: "overview",
      title: "Overview",
      content: summary.trim(),
      priority: 0,
    });
  }

  // Sort by priority
  return sections.sort((a, b) => a.priority - b.priority);
}

interface SectionProps {
  section: Section;
  isExpanded: boolean;
  onToggle: () => void;
}

function CompactSection({ section, isExpanded, onToggle }: SectionProps) {
  // For compact mode, always show overview expanded, others collapsed
  const showContent = section.id === "overview" || section.id === "company-overview" || isExpanded;

  // For overview, don't show toggle
  if (section.id === "overview" || section.id === "company-overview") {
    return (
      <div className="text-xs text-muted-foreground leading-relaxed">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            ul: ({ children }) => <ul className="list-none space-y-0.5 mt-1">{children}</ul>,
            li: ({ children }) => <li className="flex items-start gap-1"><span className="text-primary">•</span><span>{children}</span></li>,
          }}
        >
          {section.content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {section.title}
      </button>
      {showContent && (
        <div className="mt-1 text-xs text-muted-foreground leading-relaxed pl-4">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              ul: ({ children }) => <ul className="list-none space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="flex items-start gap-1"><span className="text-primary shrink-0">•</span><span>{children}</span></li>,
            }}
          >
            {section.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function FullSection({ section, isExpanded, onToggle }: SectionProps) {
  return (
    <div className="border-b border-border pb-3 last:border-b-0 last:pb-0">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        {section.title}
      </button>
      {isExpanded && (
        <div className="mt-2 text-sm text-muted-foreground leading-relaxed pl-6 prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-outside ml-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-outside ml-4 space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
            }}
          >
            {section.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
