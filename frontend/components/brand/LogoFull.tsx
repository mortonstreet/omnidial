import { cn } from "@/lib/utils";
import { LogoIcon } from "./LogoIcon";

interface LogoFullProps {
  className?: string;
  iconSize?: number;
}

export function LogoFull({ className, iconSize = 32 }: LogoFullProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label="OmniDial">
      <LogoIcon size={iconSize} />
      <span className="font-medium text-xl tracking-tight whitespace-nowrap">OmniDial</span>
    </div>
  );
}
