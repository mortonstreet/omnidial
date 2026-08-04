"use client";

import { useState, useMemo, useEffect } from "react";
import DOMPurify from "dompurify";
import { ChevronDown, ChevronRight, FileText, Loader2, Settings, StickyNote, Send } from "lucide-react";
import { useScripts } from "@/hooks/api/useScripts";
import { useNotes, useCreateNote } from "@/hooks/api/useNotes";
import { formatDistanceToNow } from "date-fns";

interface Lead {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string;
  company?: string | null;
  title?: string | null;
  linkedInUrl?: string | null;
  website?: string | null;
  customFields?: Record<string, string>;
}

interface ScriptPanelProps {
  campaignId?: string;
  lead?: Lead | null;
  onManageScripts?: () => void;
}

// Substitute variables in script content
function substituteVariables(content: string, lead?: Lead | null): string {
  if (!content) return "";
  if (!lead) return content;

  let result = content;

  // Standard lead fields
  const standardFields: Record<string, string | undefined | null> = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    title: lead.title,
    linkedInUrl: lead.linkedInUrl,
    website: lead.website,
  };

  // Replace standard fields
  for (const [key, value] of Object.entries(standardFields)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    result = result.replace(regex, value || `[${key}]`);
  }

  // Replace custom fields
  if (lead.customFields) {
    for (const [key, value] of Object.entries(lead.customFields)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      result = result.replace(regex, value || `[${key}]`);
    }
  }

  // Mark any remaining unmatched variables
  result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, "[$1]");

  return result;
}

// Highlight unmatched variables in rendered content
function highlightVariables(html: string): string {
  return html.replace(
    /\[(\w+)\]/g,
    '<span class="px-1 py-0.5 bg-yellow-500/20 text-yellow-500 rounded text-xs font-mono">[$1]</span>'
  );
}

// Render text with URLs converted to clickable links
function linkifyContent(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<]+(?:\([^\s<]*\))?[^\s<.,;:!?)}\]]*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[1];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline break-all"
      >
        {url}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function ScriptPanel({ campaignId, lead, onManageScripts }: ScriptPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState<string | undefined>();

  // Fetch scripts for this campaign (including org-wide scripts)
  const { data: scripts, isLoading } = useScripts(campaignId);

  // Fetch existing notes for the current lead
  const { data: notesData, isLoading: notesLoading } = useNotes({
    leadId: lead?.id || "",
  });
  const existingNotes = notesData?.data || [];

  // Create note mutation
  const createNote = useCreateNote();

  // Clear new note when lead changes
  useEffect(() => {
    queueMicrotask(() => setNewNote(""));
  }, [lead?.id]);

  // Handle adding a new note
  const handleAddNote = async () => {
    if (!newNote.trim() || !lead?.id) return;

    try {
      await createNote.mutateAsync({
        leadId: lead.id,
        content: newNote.trim(),
      });
      setNewNote("");
    } catch (error) {
      console.error("Failed to create note:", error);
    }
  };

  // Handle Enter key to submit note
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  // Get the active script (selected or default)
  const activeScript = useMemo(() => {
    if (!scripts || scripts.length === 0) return null;

    // If a script is selected, use that
    if (selectedScriptId) {
      return scripts.find((s) => s.id === selectedScriptId) || null;
    }

    // Otherwise use the default script or the first one
    return scripts.find((s) => s.isDefault) || scripts[0];
  }, [scripts, selectedScriptId]);

  // Substitute variables in the script content
  const processedContent = useMemo(() => {
    if (!activeScript) return "";
    return substituteVariables(activeScript.content, lead);
  }, [activeScript, lead]);

  // Render the script section content based on state
  const renderScriptSection = () => {
    if (!campaignId) {
      return (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span className="text-sm">Select a campaign to view scripts</span>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading scripts...</span>
          </div>
        </div>
      );
    }

    if (!scripts || scripts.length === 0) {
      return (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span className="text-sm">No scripts available</span>
            </div>
            {onManageScripts && (
              <button
                onClick={onManageScripts}
                className="text-xs text-primary hover:underline"
              >
                Create Script
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header - Collapsible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Call Script</span>
            {activeScript && (
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                {activeScript.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onManageScripts && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onManageScripts();
                }}
                className="p-1 hover:bg-muted rounded transition"
                title="Manage Scripts"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </button>

        {/* Content */}
        {isExpanded && (
          <div className="border-t border-border">
            {/* Script selector (if multiple scripts) */}
            {scripts.length > 1 && (
              <div className="p-2 border-b border-border bg-muted/20">
                <select
                  value={selectedScriptId || activeScript?.id || ""}
                  onChange={(e) => setSelectedScriptId(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {scripts.map((script) => (
                    <option key={script.id} value={script.id}>
                      {script.name}
                      {script.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Script content - rendered as HTML with rich text */}
            <div className="p-3 max-h-80 overflow-y-auto">
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-foreground [&_em]:text-foreground [&_u]:text-foreground"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(highlightVariables(processedContent)),
                }}
              />
            </div>

            {/* Lead info indicator */}
            {lead && (
              <div className="px-3 py-2 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Variables filled for:{" "}
                  <span className="text-foreground font-medium">
                    {lead.firstName || "Unknown"} {lead.lastName || ""}
                  </span>
                  {lead.company && (
                    <span className="text-muted-foreground"> at {lead.company}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Script Panel */}
      {renderScriptSection()}

      {/* Notes Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setIsNotesExpanded(!isNotesExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isNotesExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <StickyNote className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Lead Notes</span>
            {existingNotes.length > 0 && (
              <span className="text-xs text-primary px-2 py-0.5 bg-primary/10 rounded-full font-medium">
                {existingNotes.length}
              </span>
            )}
          </div>
        </button>

        {isNotesExpanded && (
          <div className="border-t border-border">
            {/* No lead selected state */}
            {!lead?.id ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Select a lead to view and add notes
              </div>
            ) : (
              <>
                {/* Existing notes list */}
                <div className="max-h-48 overflow-y-auto">
                  {notesLoading ? (
                    <div className="p-4 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : existingNotes.length > 0 ? (
                    <div className="divide-y divide-border">
                      {existingNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 hover:bg-muted/20 transition-colors"
                        >
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {linkifyContent(note.content)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No notes yet for this lead
                    </div>
                  )}
                </div>

                {/* Add new note input */}
                <div className="border-t border-border p-3">
                  <div className="flex gap-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Add a note... (Enter to save)"
                      rows={2}
                      className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || createNote.isPending}
                      className="self-end px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Add note"
                    >
                      {createNote.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
