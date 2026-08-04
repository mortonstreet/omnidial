import { cn } from "@/lib/utils";

interface GoogleSheetsIconProps {
  className?: string;
}

export function GoogleSheetsIcon({ className }: GoogleSheetsIconProps) {
  return (
    <svg
      className={cn("w-6 h-6", className)}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M37 45H11C8.24 45 6 42.76 6 40V8C6 5.24 8.24 3 11 3H30L42 15V40C42 42.76 39.76 45 37 45Z"
        fill="#43A047"
      />
      <path d="M42 15H30V3L42 15Z" fill="#C8E6C9" />
      <path d="M30 3L42 15H30V3Z" fill="#2E7D32" fillOpacity="0.2" />
      <path d="M34 23H14V37H34V23Z" fill="#FFFFFF" />
      <path d="M20 23V37" stroke="#43A047" strokeWidth="1.5" />
      <path d="M27 23V37" stroke="#43A047" strokeWidth="1.5" />
      <path d="M14 28H34" stroke="#43A047" strokeWidth="1.5" />
      <path d="M14 33H34" stroke="#43A047" strokeWidth="1.5" />
    </svg>
  );
}
