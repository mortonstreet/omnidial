import { cn } from "@/lib/utils";

interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className, size = 32 }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(className)}
      aria-label="OmniDial"
    >
      {/* Ring (the O) */}
      <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="2.5" fill="none"/>
      {/* Dial indicator dot */}
      <circle cx="17" cy="7" r="2.5" fill="white"/>
    </svg>
  );
}
