"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ToastBannerProps {
  message: string;
  type?: "default" | "error";
  visible: boolean;
  onClose?: () => void;
  autoDismiss?: number;
}

function ToastBanner({
  message,
  type = "default",
  visible,
  onClose,
  autoDismiss = 4000,
}: ToastBannerProps) {
  React.useEffect(() => {
    if (visible && autoDismiss && onClose) {
      const timer = setTimeout(onClose, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [visible, autoDismiss, onClose]);

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100]",
        "transform transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div
        className={cn(
          "w-full px-4 py-3 text-center text-sm font-medium",
          "border-b",
          type === "error"
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : "bg-card text-foreground border-border"
        )}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-center relative">
          <span>{message}</span>
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-0 p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for managing toast banners
function useToastBanner() {
  const [state, setState] = React.useState<{
    message: string;
    type: "default" | "error";
    visible: boolean;
  }>({
    message: "",
    type: "default",
    visible: false,
  });

  const show = React.useCallback(
    (message: string, type: "default" | "error" = "default") => {
      setState({ message, type, visible: true });
    },
    []
  );

  const hide = React.useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const ToastComponent = React.useCallback(
    () => (
      <ToastBanner
        message={state.message}
        type={state.type}
        visible={state.visible}
        onClose={hide}
      />
    ),
    [state, hide]
  );

  return { show, hide, Toast: ToastComponent };
}

export { ToastBanner, useToastBanner };
