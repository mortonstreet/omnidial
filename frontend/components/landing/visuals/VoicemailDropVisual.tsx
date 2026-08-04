"use client";

import { useEffect, useState } from "react";
import { Check, ArrowRight } from "lucide-react";

export function VoicemailDropVisual() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2">
      <div
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
          step >= 1 ? "border-foreground bg-foreground" : "border-foreground/30"
        }`}
      >
        {step >= 1 && <Check className="w-3 h-3 text-background" />}
      </div>
      <ArrowRight
        className={`w-4 h-4 transition-all duration-300 ${
          step >= 2 ? "text-foreground translate-x-1" : "text-foreground/30"
        }`}
      />
      <div
        className={`w-4 h-4 rounded-sm transition-all duration-300 ${
          step >= 2 ? "bg-foreground/60" : "bg-foreground/20"
        }`}
      />
    </div>
  );
}
