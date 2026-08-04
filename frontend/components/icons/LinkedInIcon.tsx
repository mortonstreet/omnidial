import { cn } from "@/lib/utils";

interface LinkedInIconProps {
  className?: string;
}

export function LinkedInIcon({ className }: LinkedInIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("w-4 h-4", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="20" height="20" rx="1.5" fill="#0A66C2" />
      <path
        d="M8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"
        fill="white"
      />
    </svg>
  );
}
