"use client";

import { useState, useEffect, useRef } from "react";

// Omnidial Logo Component - ring + dial indicator
const OmniDialLogo = ({ size = 28 }: { size?: number }) => (
  <div
    className="bg-white rounded-md flex items-center justify-center overflow-hidden"
    style={{ width: size, height: size }}
  >
    <svg
      width={size - 6}
      height={size - 6}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="7" stroke="#0a0a0a" strokeWidth="2.5" fill="none"/>
      <circle cx="17" cy="7" r="2.5" fill="#0a0a0a"/>
    </svg>
  </div>
);

// Competitor Logo Components with actual brand SVGs
const DialpadLogo = ({ size = 28 }: { size?: number }) => (
  <div
    className="rounded-md flex items-center justify-center overflow-hidden"
    style={{ width: size, height: size, backgroundColor: "#7C52FF" }}
  >
    {/* Dialpad star icon from official SVG */}
    <svg
      width={size - 8}
      height={size - 8}
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M14.797 7.439c0.2 0.045 0.24 0.372 0.05 0.457-3.613 1.23-6.457 4.374-7.942 8.56-0.081 0.203-0.438 0.152-0.471-0.064-0.508-3.283-2.776-5.904-5.698-6.611-0.194-0.045-0.23-0.35-0.05-0.436 3.71-1.526 6.498-4.657 7.786-8.657 0.08-0.209 0.469-0.156 0.502 0.066 0.5 3.348 2.829 6.017 5.823 6.685z"
        fill="white"
      />
    </svg>
  </div>
);

const AircallLogo = ({ size = 28 }: { size?: number }) => (
  <div
    className="rounded-md flex items-center justify-center overflow-hidden"
    style={{ width: size, height: size, backgroundColor: "#00B388" }}
  >
    {/* Aircall phone/droplet icon from official SVG */}
    <svg
      width={size - 8}
      height={size - 8}
      viewBox="0 0 200 200"
      fill="none"
    >
      <path
        d="M150.8,4.3C139.5,1.7,121,0,100,0S60.5,1.7,49.2,4.3C26.7,9,9,26.7,4.3,49.2C1.7,60.5,0,79,0,100s1.7,39.5,4.3,50.8C9,173.3,26.7,191,49.2,195.7C60.5,198.3,79,200,100,200s39.5-1.7,50.8-4.3c22.5-4.7,40.2-22.4,44.9-44.9c2.6-11.3,4.3-29.8,4.3-50.8s-1.7-39.5-4.3-50.8C191,26.7,173.3,9,150.8,4.3z"
        fill="#00B388"
      />
      <path
        d="M124,153.5c-1.9-4.5-5.9-7.9-10.8-8.9c-2.9-0.7-7.8-1.1-13.2-1.1s-10.3,0.4-13.2,1.1c-4.9,1-8.9,4.4-10.8,8.9l0,0l0,0c-0.7,1.6-2.3,2.5-3.9,2.3c-0.4,0-0.8-0.1-1.1-0.1c-7.8-0.8-14-1.9-17.6-3.1l0,0c-2.4-0.9-4.1-3.2-4.1-5.9c0-0.1,0-0.1,0-0.2c0-0.1,0-0.2,0-0.3v-0.1c0-0.1,0-0.1,0-0.2c0.6-8.2,5.6-27.3,13-49.1c8.5-24.9,17.3-45.1,21.3-49.1l0,0c0.6-0.7,1.4-1.2,2.2-1.6c0.3-0.2,0.7-0.4,1.2-0.5l0,0c2.6-0.9,7.5-1.5,13-1.5l0,0c5.5,0,10.4,0.6,13,1.5l0,0l0,0c0.5,0.2,0.9,0.3,1.2,0.5c0.8,0.4,1.5,1,2.2,1.6l0,0c4,3.9,12.8,24.1,21.3,49.1c7.4,21.8,12.4,40.9,13,49.1c0,0.1,0,0.1,0,0.2v0.1c0,0.1,0,0.2,0,0.3s0,0.1,0,0.2c0,2.7-1.7,5-4.1,5.9l0,0c-3.6,1.3-9.7,2.4-17.6,3.1c-0.3,0-0.8,0.1-1.2,0.1l0,0C126.2,155.9,124.7,155,124,153.5L124,153.5z"
        fill="white"
      />
    </svg>
  </div>
);

const TrellusLogo = ({ size = 28 }: { size?: number }) => (
  <div
    className="rounded-md flex items-center justify-center overflow-hidden"
    style={{ width: size, height: size, backgroundColor: "#03214E" }}
  >
    {/* Trellus layered icon from official SVG */}
    <svg
      width={size - 6}
      height={size - 6}
      viewBox="0 0 20 26"
      fill="none"
    >
      <path
        clipRule="evenodd"
        d="M11.922 8.55v1.842c1.148.145 2.295.295 3.443.44l.002 1.784c0 .394-.255.786-.644.776-1.16-.035-2.32-.064-3.48-.095-.006-2.134-.004-4.268-.006-6.4 0-1.764-1.48-3.324-2.952-3.823C5.533 2.14 2.802 1.134.05.2v4.586c0 2.792 2.566 4.5 4.868 4.794 1.482.19 2.967.301 4.449.486l.002 3.181-1.743-.046c-1.797-.05-3.79 1.348-3.79 3.45.002 3.05.004 6.099.004 9.149l4.456-1.507c1.469-.496 2.952-2.061 2.95-3.82l-.002-2.857v-1.612c-.625.035-1.25.016-1.874.051l.002 4.504c0 .744-.479 1.514-1.165 1.708l-1.88.533c0-2.1-.003-4.2-.004-6.298 0-.718.693-1.212 1.304-1.228l7.096-.198c1.166-.031 1.96-1.18 1.958-2.394l-.004-3.262c-1.585-.288-3.17-.581-4.756-.869zM4.964 7.28c-1.036-.19-1.75-.786-1.75-1.99V3.687l4.983 1.415c.56.16 1.168.833 1.168 1.502l.002 1.48-4.403-.804z"
        fill="#5DD077"
        fillRule="evenodd"
      />
    </svg>
  </div>
);

const RingCentralLogo = ({ size = 28 }: { size?: number }) => (
  <div
    className="rounded-lg flex items-center justify-center overflow-hidden"
    style={{
      width: size,
      height: size,
      backgroundColor: "#FFFFFF",
      border: `${Math.max(2, size / 10)}px solid #FF8200`,
    }}
  >
    {/* RingCentral - blue R letter */}
    <svg
      width={size - 8}
      height={size - 8}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Stylized R */}
      <path
        d="M6 4h8c3 0 5 2 5 5s-2 5-5 5h-2l6 6h-4l-5-6H9v6H6V4zm3 7h5c1.1 0 2-.9 2-2s-.9-2-2-2H9v4z"
        fill="#0095D9"
      />
    </svg>
  </div>
);

const TitanXLogo = ({ size = 28 }: { size?: number }) => (
  <div
    className="rounded-md flex items-center justify-center overflow-hidden"
    style={{ width: size, height: size, backgroundColor: "#FFFFFF" }}
  >
    {/* TitanX logo - stylized X with gradient chevrons */}
    <svg
      width={size - 4}
      height={size - 4}
      viewBox="0 0 48 48"
      fill="none"
    >
      <defs>
        <linearGradient id="titanx-grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E31B54" />
          <stop offset="100%" stopColor="#8B1538" />
        </linearGradient>
        <linearGradient id="titanx-grad-right" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E31B54" />
          <stop offset="100%" stopColor="#8B1538" />
        </linearGradient>
      </defs>
      {/* Left chevron pointing right */}
      <path
        d="M4 8L18 24L4 40L12 40L26 24L12 8Z"
        fill="url(#titanx-grad-left)"
      />
      {/* Right chevron pointing left */}
      <path
        d="M44 8L30 24L44 40L36 40L22 24L36 8Z"
        fill="url(#titanx-grad-right)"
      />
    </svg>
  </div>
);

// Competitor data with actual pricing from research
interface CompetitorData {
  name: string;
  price: number; // Monthly price per seat
  featureScore: number; // 1-100 scale based on features (power dialer, CRM, AI, etc.)
  logo: React.ReactNode;
  color: string;
  isOmniDial?: boolean;
  pricingNote?: string;
  website?: string;
}

const competitors: CompetitorData[] = [
  {
    name: "OmniDial",
    price: 20,
    featureScore: 92,
    logo: <OmniDialLogo size={28} />,
    color: "#ffffff",
    isOmniDial: true,
    pricingNote: "Flat rate, all features included",
    website: "/pricing",
  },
  {
    name: "TitanX",
    price: 300, // Enterprise pricing ~$20-100k/year, estimated per seat
    featureScore: 85,
    logo: <TitanXLogo size={28} />,
    color: "#FF004B", // TitanX brand pink (X logo)
    pricingNote: "Enterprise only, $20-100k/year",
    website: "https://titanx.io",
  },
  {
    name: "Dialpad",
    price: 60, // AI Sales tier for comparable features
    featureScore: 78,
    logo: <DialpadLogo size={28} />,
    color: "#7C52FF", // Dialpad brand purple
    pricingNote: "AI Sales: $60-150/mo",
    website: "https://dialpad.com/pricing",
  },
  {
    name: "Aircall",
    price: 50, // Professional plan with Power Dialer
    featureScore: 72,
    logo: <AircallLogo size={28} />,
    color: "#00B388", // Aircall brand green
    pricingNote: "Professional: $50-70/mo",
    website: "https://aircall.io/pricing",
  },
  {
    name: "Trellus",
    price: 60, // Power/Parallel tier
    featureScore: 68,
    logo: <TrellusLogo size={28} />,
    color: "#5DD077", // Trellus brand green
    pricingNote: "Power: $35-60/mo",
    website: "https://trellus.ai/pricing",
  },
  {
    name: "RingCentral",
    price: 35, // Advanced plan
    featureScore: 65,
    logo: <RingCentralLogo size={28} />,
    color: "#FF8800", // RingCentral brand orange
    pricingNote: "Advanced: $25-35/mo",
    website: "https://ringcentral.com/office/plansandpricing.html",
  },
];

// Tab configurations
type TabType = "quadrant" | "price" | "features";

interface TabConfig {
  id: TabType;
  label: string;
  title: string;
  subtitle: string;
}

const tabConfigs: Record<TabType, TabConfig> = {
  quadrant: {
    id: "quadrant",
    label: "Value Analysis",
    title: "Price vs. Features Comparison",
    subtitle: "[Top-left quadrant = best value]",
  },
  price: {
    id: "price",
    label: "Price per Seat",
    title: "Monthly Cost Comparison",
    subtitle: "[Lower is better]",
  },
  features: {
    id: "features",
    label: "Feature Score",
    title: "Feature Completeness",
    subtitle: "[Higher is better]",
  },
};

const tabs = Object.values(tabConfigs);

// Quadrant Chart Component
function QuadrantChart({
  data,
  isVisible,
}: {
  data: CompetitorData[];
  isVisible: boolean;
}) {
  const chartWidth = 600;
  const chartHeight = 400;
  const padding = { top: 40, right: 80, bottom: 60, left: 70 };

  const maxPrice = 350;
  const minFeature = 50;
  const maxFeature = 100;

  // Quadrant lines at median values
  const medianPrice = 100;
  const medianFeature = 75;

  const scaleX = (price: number) => {
    const clampedPrice = Math.min(price, maxPrice);
    return (
      padding.left +
      (clampedPrice / maxPrice) * (chartWidth - padding.left - padding.right)
    );
  };

  const scaleY = (feature: number) => {
    return (
      chartHeight -
      padding.bottom -
      ((feature - minFeature) / (maxFeature - minFeature)) *
        (chartHeight - padding.top - padding.bottom)
    );
  };

  return (
    <div className="relative w-full overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full min-w-[500px] h-auto"
        style={{ maxHeight: "450px" }}
      >
        {/* Background quadrants */}
        <rect
          x={padding.left}
          y={padding.top}
          width={scaleX(medianPrice) - padding.left}
          height={scaleY(medianFeature) - padding.top}
          fill="rgba(34, 197, 94, 0.08)"
        />
        <rect
          x={scaleX(medianPrice)}
          y={padding.top}
          width={chartWidth - padding.right - scaleX(medianPrice)}
          height={scaleY(medianFeature) - padding.top}
          fill="rgba(234, 179, 8, 0.05)"
        />
        <rect
          x={padding.left}
          y={scaleY(medianFeature)}
          width={scaleX(medianPrice) - padding.left}
          height={chartHeight - padding.bottom - scaleY(medianFeature)}
          fill="rgba(234, 179, 8, 0.05)"
        />
        <rect
          x={scaleX(medianPrice)}
          y={scaleY(medianFeature)}
          width={chartWidth - padding.right - scaleX(medianPrice)}
          height={chartHeight - padding.bottom - scaleY(medianFeature)}
          fill="rgba(239, 68, 68, 0.05)"
        />

        {/* Quadrant labels */}
        <text
          x={padding.left + 10}
          y={padding.top + 20}
          fill="rgba(34, 197, 94, 0.6)"
          fontSize="10"
          fontWeight="500"
        >
          Best Value
        </text>
        <text
          x={chartWidth - padding.right - 60}
          y={chartHeight - padding.bottom - 10}
          fill="rgba(239, 68, 68, 0.5)"
          fontSize="10"
          fontWeight="500"
        >
          Premium
        </text>

        {/* Grid lines */}
        {[0, 100, 200, 300].map((price) => (
          <line
            key={`x-${price}`}
            x1={scaleX(price)}
            y1={padding.top}
            x2={scaleX(price)}
            y2={chartHeight - padding.bottom}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="4,4"
          />
        ))}
        {[60, 70, 80, 90, 100].map((feature) => (
          <line
            key={`y-${feature}`}
            x1={padding.left}
            y1={scaleY(feature)}
            x2={chartWidth - padding.right}
            y2={scaleY(feature)}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="4,4"
          />
        ))}

        {/* Median lines */}
        <line
          x1={scaleX(medianPrice)}
          y1={padding.top}
          x2={scaleX(medianPrice)}
          y2={chartHeight - padding.bottom}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />
        <line
          x1={padding.left}
          y1={scaleY(medianFeature)}
          x2={chartWidth - padding.right}
          y2={scaleY(medianFeature)}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        {/* Axes */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />

        {/* X-axis labels */}
        {[0, 100, 200, 300].map((price) => (
          <text
            key={`xl-${price}`}
            x={scaleX(price)}
            y={chartHeight - padding.bottom + 20}
            fill="rgba(255,255,255,0.5)"
            fontSize="11"
            textAnchor="middle"
          >
            ${price}
          </text>
        ))}
        <text
          x={(padding.left + chartWidth - padding.right) / 2}
          y={chartHeight - 15}
          fill="rgba(255,255,255,0.6)"
          fontSize="12"
          textAnchor="middle"
          fontWeight="500"
        >
          Monthly Price per Seat →
        </text>

        {/* Y-axis labels */}
        {[60, 70, 80, 90, 100].map((feature) => (
          <text
            key={`yl-${feature}`}
            x={padding.left - 10}
            y={scaleY(feature) + 4}
            fill="rgba(255,255,255,0.5)"
            fontSize="11"
            textAnchor="end"
          >
            {feature}
          </text>
        ))}
        <text
          x={15}
          y={(padding.top + chartHeight - padding.bottom) / 2}
          fill="rgba(255,255,255,0.6)"
          fontSize="12"
          textAnchor="middle"
          fontWeight="500"
          transform={`rotate(-90, 15, ${(padding.top + chartHeight - padding.bottom) / 2})`}
        >
          ↑ Feature Score
        </text>

        {/* Data points */}
        {data.map((competitor, idx) => {
          const x = scaleX(competitor.price);
          const y = scaleY(competitor.featureScore);
          const logoSize = competitor.isOmniDial ? 32 : 24;

          return (
            <g
              key={competitor.name}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "scale(1)" : "scale(0)",
                transformOrigin: `${x}px ${y}px`,
                transition: `all 0.6s ease-out ${idx * 100}ms`,
              }}
            >
              {/* Glow effect for OmniDial */}
              {competitor.isOmniDial && (
                <circle
                  cx={x}
                  cy={y}
                  r={logoSize / 2 + 6}
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                />
              )}

              {/* Logo container */}
              <foreignObject
                x={x - logoSize / 2}
                y={y - logoSize / 2}
                width={logoSize}
                height={logoSize}
                className="overflow-visible"
              >
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    transform: `scale(${logoSize / 32})`,
                    transformOrigin: "center",
                  }}
                >
                  {competitor.logo}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Horizontal Bar Chart Component
function HorizontalBarChart({
  data,
  isVisible,
  metric,
  formatValue,
  maxValue,
}: {
  data: CompetitorData[];
  isVisible: boolean;
  metric: "price" | "featureScore";
  formatValue: (v: number) => string;
  maxValue: number;
}) {
  const sortedData = [...data].sort((a, b) =>
    metric === "price" ? a[metric] - b[metric] : b[metric] - a[metric]
  );

  return (
    <div className="space-y-4">
      {sortedData.map((competitor, idx) => {
        const value = competitor[metric];
        const percentage = Math.min((value / maxValue) * 100, 100);

        return (
          <div key={competitor.name} className="flex items-center gap-4">
            <div className="w-8 h-8 flex-shrink-0">{competitor.logo}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium ${
                    competitor.isOmniDial ? "text-white" : "text-white/70"
                  }`}
                >
                  {competitor.name}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    competitor.isOmniDial ? "text-green-400" : "text-white/60"
                  }`}
                >
                  {formatValue(value)}
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    competitor.isOmniDial
                      ? "bg-gradient-to-r from-green-500 to-emerald-400"
                      : "bg-white/30"
                  }`}
                  style={{
                    width: isVisible ? `${percentage}%` : "0%",
                    transitionDelay: `${idx * 80}ms`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DarkBenchmarkChart() {
  const [activeTab, setActiveTab] = useState<TabType>("quadrant");
  const [displayedTab, setDisplayedTab] = useState<TabType>("quadrant");
  const [isVisible, setIsVisible] = useState(() => {
    // On mobile/tablet (under 1024px), start visible - skip scroll-triggered animation
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024;
    }
    return false;
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);

  const config = tabConfigs[displayedTab];

  useEffect(() => {
    // On mobile/tablet, already visible from initial state - no observer needed
    if (window.innerWidth < 1024) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;

    setIsTransitioning(true);
    setActiveTab(tab);

    setTimeout(() => {
      setDisplayedTab(tab);
      setAnimationKey((prev) => prev + 1);

      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }, 250);
  };

  return (
    <section
      className="py-12 sm:py-16 md:py-24 lg:py-32 bg-[#0a0a0a]"
      ref={chartRef}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-[1fr,320px] gap-12 lg:gap-16">
          {/* Chart Area */}
          <div>
            {/* Tabs */}
            <div className="flex items-center gap-0.5 sm:gap-1 mb-6 sm:mb-8 border-b border-white/10 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap ${
                    activeTab === tab.id
                      ? "text-white"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </button>
              ))}
            </div>

            {/* Chart Title */}
            <div
              className={`mb-4 sm:mb-6 transition-opacity duration-250 ease-out ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-white">
                {config.title}
              </h2>
              <p className="text-xs sm:text-sm text-white/40 mt-1">
                {config.subtitle}
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6 sm:mb-8 text-xs sm:text-sm">
              {competitors.map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <div className="scale-75 sm:scale-100">{c.logo}</div>
                  <span
                    className={
                      c.isOmniDial ? "text-white font-medium" : "text-white/50"
                    }
                  >
                    {c.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Chart Content */}
            <div
              key={animationKey}
              className={`transition-opacity duration-250 ease-out ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              {displayedTab === "quadrant" && (
                <QuadrantChart data={competitors} isVisible={isVisible} />
              )}

              {displayedTab === "price" && (
                <HorizontalBarChart
                  data={competitors}
                  isVisible={isVisible}
                  metric="price"
                  formatValue={(v) => `$${v}/mo`}
                  maxValue={350}
                />
              )}

              {displayedTab === "features" && (
                <HorizontalBarChart
                  data={competitors}
                  isVisible={isVisible}
                  metric="featureScore"
                  formatValue={(v) => `${v}/100`}
                  maxValue={100}
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="mt-8 lg:mt-0 pt-8 lg:pt-0 border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-10">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-white flex items-center gap-3">
              Why OmniDial?
              <span className="flex-1 h-px bg-white/10" />
            </h3>
            <div
              className={`transition-opacity duration-250 ease-out ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              <p className="text-sm text-white/60 leading-relaxed mb-8">
                {displayedTab === "quadrant" &&
                  "OmniDial sits in the best-value quadrant: high features at the lowest price. Enterprise-grade capabilities without enterprise pricing."}
                {displayedTab === "price" &&
                  "We believe great sales tools shouldn't break the bank. OmniDial includes everything you need at one flat rate - no hidden fees, no per-minute charges."}
                {displayedTab === "features" &&
                  "Full-featured power dialer with built-in CRM, call recording, AI transcription, and analytics. Everything competitors charge extra for is included."}
              </p>

              <div className="space-y-5">
                <a href="#features" className="block group">
                  <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors underline decoration-white/20 underline-offset-2">
                    Power Dialer
                    <span className="ml-1 no-underline">→</span>
                  </p>
                  <p className="text-sm text-white/50 mt-1">
                    Auto-advance through your list with zero downtime.
                  </p>
                </a>

                <a href="#features" className="block group">
                  <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors underline decoration-white/20 underline-offset-2">
                    Call Recording
                    <span className="ml-1 no-underline">→</span>
                  </p>
                  <p className="text-sm text-white/50 mt-1">
                    Every call captured, transcribed, and searchable.
                  </p>
                </a>

                <a href="#features" className="block group">
                  <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors underline decoration-white/20 underline-offset-2">
                    Built-in CRM
                    <span className="ml-1 no-underline">→</span>
                  </p>
                  <p className="text-sm text-white/50 mt-1">
                    Pipeline, notes, and history without extra software.
                  </p>
                </a>

                <a href="/pricing" className="block group">
                  <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors underline decoration-white/20 underline-offset-2">
                    View Pricing
                    <span className="ml-1 no-underline">→</span>
                  </p>
                  <p className="text-sm text-white/50 mt-1">
                    Simple, transparent pricing. No surprises.
                  </p>
                </a>
              </div>
            </div>

            {/* Competitor Pricing Sources - footnote style */}
            <div className="mt-10 pt-6 border-t border-white/5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">
                Sources
              </p>
              <div className="space-y-1.5 text-[11px]">
                {competitors
                  .filter((c) => !c.isOmniDial)
                  .map((c) => (
                    <a
                      key={c.name}
                      href={c.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-white/30 hover:text-white/50 transition-colors"
                    >
                      <span>{c.name}</span>
                      <span>{c.pricingNote}</span>
                    </a>
                  ))}
              </div>
              <p className="text-[10px] text-white/20 mt-4 leading-relaxed">
                Pricing as of Jan 2026. Competitor rates may vary by plan and region.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
