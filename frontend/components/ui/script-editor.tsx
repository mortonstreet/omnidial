"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Underline as UnderlineIcon, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeight?: string;
}

function MenuBar({ editor, onExpand }: { editor: Editor | null; onExpand?: () => void }) {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-2 border-b border-border">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={cn(
            "p-1.5 rounded hover:bg-muted transition-colors",
            editor.isActive("bold") && "bg-muted text-foreground"
          )}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={cn(
            "p-1.5 rounded hover:bg-muted transition-colors",
            editor.isActive("italic") && "bg-muted text-foreground"
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={cn(
            "p-1.5 rounded hover:bg-muted transition-colors",
            editor.isActive("underline") && "bg-muted text-foreground"
          )}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
      </div>
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Expand editor"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function FullscreenModal({
  isOpen,
  onClose,
  value,
  onChange,
  placeholder,
}: {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder || "Start writing your script...",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              disabled={!editor?.can().chain().focus().toggleBold().run()}
              className={cn(
                "p-1.5 rounded hover:bg-muted transition-colors",
                editor?.isActive("bold") && "bg-muted text-foreground"
              )}
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              disabled={!editor?.can().chain().focus().toggleItalic().run()}
              className={cn(
                "p-1.5 rounded hover:bg-muted transition-colors",
                editor?.isActive("italic") && "bg-muted text-foreground"
              )}
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              disabled={!editor?.can().chain().focus().toggleUnderline().run()}
              className={cn(
                "p-1.5 rounded hover:bg-muted transition-colors",
                editor?.isActive("underline") && "bg-muted text-foreground"
              )}
              title="Underline (Ctrl+U)"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-auto">
          <EditorContent
            editor={editor}
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none h-full",
              "[&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:h-full [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-4 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-base [&_.ProseMirror]:leading-relaxed",
              "[&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0"
            )}
          />
        </div>

        {/* Footer with variable hint */}
        <div className="px-4 py-3 border-t border-border">
          <span className="text-sm text-muted-foreground">
            Type <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{"{{"}</code> to add variables
          </span>
        </div>
      </div>
    </div>
  );
}

export function ScriptEditor({
  value,
  onChange,
  placeholder = "Start writing your script...",
  className,
  disabled = false,
  minHeight = "200px",
}: ScriptEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  const handleExpand = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
    // Sync content back to inline editor
    if (editor) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  return (
    <>
      <div
        className={cn(
          "border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex flex-col w-full rounded-lg border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <MenuBar editor={editor} onExpand={handleExpand} />
        <EditorContent
          editor={editor}
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none flex-1",
            "[&_.ProseMirror]:px-3 [&_.ProseMirror]:py-3 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-relaxed",
            "[&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0"
          )}
          style={{ minHeight }}
        />
        {/* Footer with variable hint */}
        <div className="px-3 py-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Type <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{"{{"}</code> to add variables
          </span>
        </div>
      </div>

      <FullscreenModal
        isOpen={isFullscreen}
        onClose={handleCloseFullscreen}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </>
  );
}
