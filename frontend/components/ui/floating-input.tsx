"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export interface FloatingInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: boolean;
  success?: boolean;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, error, success, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(!!e.target.value);
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value);
      props.onChange?.(e);
    };

    const isFloating = isFocused || hasValue || !!props.value || !!props.defaultValue;

    return (
      <div className={cn("relative", className)}>
        <input
          id={inputId}
          ref={ref}
          placeholder=" "
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={cn(
            "peer w-full h-12 px-4 pt-5 pb-2 bg-transparent text-foreground",
            "border rounded-md transition-colors duration-150",
            "focus:outline-none",
            error
              ? "border-destructive focus:border-destructive"
              : "border-border focus:border-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "absolute left-4 text-muted-foreground transition-all duration-150 pointer-events-none",
            isFloating
              ? "top-2 text-xs"
              : "top-1/2 -translate-y-1/2 text-base"
          )}
        >
          {label}
        </label>

        {/* Validation indicator */}
        {(success || error) && !isFocused && hasValue && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {success && <Check className="w-4 h-4 text-chart-4" />}
            {error && <X className="w-4 h-4 text-destructive" />}
          </div>
        )}
      </div>
    );
  }
);

FloatingInput.displayName = "FloatingInput";

export { FloatingInput };
