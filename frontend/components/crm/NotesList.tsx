"use client";

import { useState } from "react";
import { useNotes, useCreateNote, useDeleteNote } from "@/hooks/api/useNotes";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

interface NotesListProps {
  leadId: string;
}

export function NotesList({ leadId }: NotesListProps) {
  const { data: notesData, isLoading } = useNotes({ leadId });
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");

  const notes = notesData?.data || [];

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    try {
      await createNote.mutateAsync({
        leadId,
        content: newNoteContent.trim(),
      });
      setNewNoteContent("");
      setShowAddForm(false);
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNote.mutateAsync({ id: noteId, leadId });
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading notes...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Notes</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="w-4 h-4" />
          Add Note
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateNote} className="space-y-2">
          <textarea
            className="w-full min-h-[100px] p-3 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Write a note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createNote.isPending}>
              {createNote.isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No notes yet</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-lg border border-border bg-card"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-foreground whitespace-pre-wrap flex-1">
                  {linkifyContent(note.content)}
                </p>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
