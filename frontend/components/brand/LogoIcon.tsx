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
      <defs>
        {/* Body tone: dark at the upper-right, bright along the lower-left,
            matching where the 3D render catches its key light. */}
        <linearGradient id="od-body" x1="4.5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6f686d" />
          <stop offset="0.38" stopColor="#4d474b" />
          <stop offset="0.72" stopColor="#9c9599" />
          <stop offset="1" stopColor="#efecee" />
        </linearGradient>

        {/* Specular running along the tube's outer shoulder. */}
        <linearGradient id="od-spec" x1="6" y1="19" x2="18" y2="7" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Contact shadow on the inner wall, which is what makes it read round. */}
        <radialGradient id="od-inner" cx="12" cy="12" r="9" gradientUnits="userSpaceOnUse">
          <stop offset="0.52" stopColor="#000000" stopOpacity="0.55" />
          <stop offset="0.72" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Tube body */}
      <circle cx="12" cy="12" r="7.6" stroke="url(#od-body)" strokeWidth="5.4" fill="none" />

      {/* Highlight, offset outward so the tube reads as a cylinder not a band */}
      <circle
        cx="12"
        cy="12"
        r="9.1"
        stroke="url(#od-spec)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Inner-wall shading */}
      <circle cx="12" cy="12" r="7.6" stroke="url(#od-inner)" strokeWidth="5.4" fill="none" />

      {/* Seams where the swept square profile turns a quarter */}
      <path d="M12 4.5 V7.1" stroke="#1c191b" strokeOpacity="0.55" strokeWidth="0.9" />
      <path d="M19.5 12 H16.9" stroke="#1c191b" strokeOpacity="0.4" strokeWidth="0.9" />
      <path d="M12 19.5 V16.9" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.9" />
      <path d="M4.5 12 H7.1" stroke="#1c191b" strokeOpacity="0.3" strokeWidth="0.9" />
    </svg>
  );
}
