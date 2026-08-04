"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditableCellProps {
  value: string | null | undefined;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  type?: "text" | "phone";
}

// Format phone for display: (123) 456-7890
function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// Strip to just digits
function stripToDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function EditableCell({
  value,
  onSave,
  placeholder = "-",
  className,
  type = "text",
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isSaving) {
      // For phone, show just digits when editing
      if (type === "phone") {
        setEditValue(stripToDigits(value ?? ""));
      } else {
        setEditValue(value ?? "");
      }
      setError(null);
      setIsEditing(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (type === "phone") {
      // Only allow digits for phone
      const digitsOnly = stripToDigits(newValue);
      setEditValue(digitsOnly);

      // Clear error when typing
      if (error) setError(null);
    } else {
      setEditValue(newValue);
    }
  };

  const validatePhone = (digits: string): string | null => {
    if (!digits) return null; // Allow empty (clearing the field)
    if (digits.length !== 10) {
      return "Phone must be exactly 10 digits";
    }
    return null;
  };

  const handleSave = async () => {
    let trimmedValue = editValue.trim();

    // Phone validation
    if (type === "phone") {
      const digits = stripToDigits(trimmedValue);
      const validationError = validatePhone(digits);

      if (validationError) {
        setError(validationError);
        toast.error(validationError);
        return; // Don't close, let user fix
      }
      trimmedValue = digits;
    }

    // Don't save if value hasn't changed
    const originalValue = type === "phone" ? stripToDigits(value ?? "") : (value ?? "");
    if (trimmedValue === originalValue) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedValue);
      setIsEditing(false);
      setError(null);
    } catch {
      // Keep editing on error so user can retry
      if (type === "phone") {
        setEditValue(stripToDigits(value ?? ""));
      } else {
        setEditValue(value ?? "");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (type === "phone") {
      setEditValue(stripToDigits(value ?? ""));
    } else {
      setEditValue(value ?? "");
    }
    setError(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={handleChange}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          maxLength={type === "phone" ? 10 : undefined}
          inputMode={type === "phone" ? "numeric" : undefined}
          className={cn(
            "h-8 py-1 px-2 text-sm",
            isSaving && "opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
        />
        {isSaving && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <p className="text-xs text-destructive mt-1 absolute whitespace-nowrap">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Display value - format phone numbers nicely
  const displayValue = type === "phone"
    ? formatPhoneDisplay(value) || placeholder
    : value || placeholder;
  const isEmpty = !value;

  return (
    <div
      onClick={handleClick}
      className={cn(
        "cursor-pointer px-2 py-1 -mx-2 -my-1 rounded hover:bg-muted/50 transition-colors min-h-[28px] flex items-center",
        isEmpty && "text-muted-foreground",
        className
      )}
      title="Click to edit"
    >
      {displayValue}
    </div>
  );
}
