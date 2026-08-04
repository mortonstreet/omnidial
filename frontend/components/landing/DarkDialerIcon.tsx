"use client";

export default function DarkDialerIcon() {
  return (
    <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto">
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className="w-full h-full"
      >
        {/* Outer ring with gradient */}
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fafafa" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#fafafa" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="phoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#a3a3a3" />
          </linearGradient>
        </defs>

        {/* Outer decorative ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="url(#ringGradient)"
          strokeWidth="1"
          fill="none"
        />

        {/* Inner subtle ring */}
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke="url(#ringGradient)"
          strokeWidth="0.5"
          fill="none"
          strokeDasharray="4 4"
        />

        {/* Center phone icon */}
        <g transform="translate(30, 25)">
          <rect
            x="5"
            y="3"
            width="30"
            height="44"
            rx="4"
            stroke="url(#phoneGrad)"
            strokeWidth="2"
            fill="none"
          />
          {/* Screen */}
          <rect
            x="9"
            y="10"
            width="22"
            height="28"
            rx="2"
            stroke="url(#phoneGrad)"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />
          {/* Speaker */}
          <line
            x1="15"
            y1="6"
            x2="25"
            y2="6"
            stroke="url(#phoneGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Home button */}
          <circle
            cx="20"
            cy="43"
            r="3"
            stroke="url(#phoneGrad)"
            strokeWidth="1.5"
            fill="none"
          />
        </g>

        {/* Signal waves */}
        <path
          d="M 72 35 C 78 38, 78 45, 72 48"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        <path
          d="M 76 32 C 85 37, 85 48, 76 53"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M 80 29 C 92 35, 92 50, 80 56"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.3"
        />
      </svg>

      {/* Animated pulse ring */}
      <div className="absolute inset-0 rounded-full animate-ping opacity-10 border border-white" style={{ animationDuration: "2s" }} />
    </div>
  );
}
