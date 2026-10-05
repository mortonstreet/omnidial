"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Destructive action that needs two clicks: the first arms it ("Click again
 * to confirm"), the second runs it. Disarms itself after a few seconds.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Click again to confirm",
  onConfirm,
  disabled,
  className,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <Button
      variant={armed ? "destructive" : "outline"}
      disabled={disabled}
      className={cn(!armed && "text-red-600 hover:text-red-700", className)}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
