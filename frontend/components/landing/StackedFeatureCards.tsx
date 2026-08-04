"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, ChevronRight, ArrowRight, Trophy, Headphones, Target } from "lucide-react";

// Hook to detect mobile/tablet
function useIsMobileOrTablet() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 1024;
      setIsMobileOrTablet(isTouchDevice || isSmallScreen);
    };

    checkDevice();
  }, []);

  return isMobileOrTablet;
}

// Hook for visibility detection
function useIsVisible(ref: React.RefObject<HTMLElement | null>) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry?.isIntersecting ?? false),
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  demo: (props: { isMobile: boolean; isVisible: boolean }) => React.ReactNode;
}

// Power Dialer Demo - shows live dialing through contacts
function PowerDialerDemo({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const contacts = [
    { name: "Sarah Chen", company: "Acme Corp", status: "Connected", statusColor: "text-green-400", bgColor: "bg-green-500/10 border-green-500/20" },
    { name: "Mike Johnson", company: "TechStart", status: "No Answer", statusColor: "text-red-400", bgColor: "bg-transparent" },
    { name: "Lisa Park", company: "GrowthCo", status: "Voicemail", statusColor: "text-yellow-400", bgColor: "bg-transparent" },
    { name: "David Kim", company: "ScaleUp", status: "Queued", statusColor: "text-white/40", bgColor: "bg-white/5" },
  ];

  useEffect(() => {
    // Disable animation on mobile or when not visible
    if (isMobile || !isVisible) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % contacts.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [contacts.length, isMobile, isVisible]);

  return (
    <div className="space-y-2">
      {contacts.map((contact, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-500 border ${
            i === activeIndex ? "bg-green-500/10 border-green-500/20 scale-[1.02]" : "border-transparent " + contact.bgColor
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
            i === activeIndex ? "bg-green-500 text-black" : "bg-white/10 text-white"
          }`}>
            {contact.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-white truncate">{contact.name}</div>
            <div className="text-xs text-white/40 truncate">{contact.company}</div>
          </div>
          <div className="text-right">
            <div className={`text-xs font-medium ${i === activeIndex ? "text-green-400" : contact.statusColor}`}>
              {i === activeIndex ? "Connected" : contact.status}
            </div>
            <div className="text-xs text-white/30">{i === activeIndex ? "2:34" : "--:--"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// AI Sales Coach Demo - shows call scoring
function SalesCoachDemo() {
  const [score] = useState(8.5);
  const insights = [
    { label: "Opening", rating: "Strong", color: "text-green-400" },
    { label: "Discovery", rating: "Good", color: "text-blue-400" },
    { label: "Objection Handling", rating: "Needs Work", color: "text-yellow-400" },
    { label: "Close", rating: "Strong", color: "text-green-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Score display */}
      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 -rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28" fill="none" stroke="#22c55e" strokeWidth="4"
              strokeDasharray={`${(score / 10) * 176} 176`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">{score}</span>
        </div>
        <div>
          <div className="text-sm text-white/40">Call Score</div>
          <div className="text-lg font-semibold text-green-400">High Performer</div>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
            <span className="text-sm text-white/60">{insight.label}</span>
            <span className={`text-xs font-medium ${insight.color}`}>{insight.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sales Floor Demo - shows live leaderboard
function SalesFloorDemo({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [reps, setReps] = useState([
    { name: "Alex M.", calls: 47, connects: 12, active: true },
    { name: "Sarah K.", calls: 43, connects: 10, active: false },
    { name: "Mike T.", calls: 38, connects: 9, active: true },
    { name: "Lisa P.", calls: 31, connects: 7, active: false },
  ]);

  useEffect(() => {
    // Disable animation on mobile or when not visible
    if (isMobile || !isVisible) return;

    const interval = setInterval(() => {
      setReps(prev => prev.map(rep => ({
        ...rep,
        calls: rep.calls + (Math.random() > 0.7 ? 1 : 0),
        connects: rep.connects + (Math.random() > 0.9 ? 1 : 0),
      })).sort((a, b) => b.calls - a.calls));
    }, 2000);
    return () => clearInterval(interval);
  }, [isMobile, isVisible]);

  return (
    <div className="space-y-3">
      {/* Blitz header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
        <Trophy className="w-4 h-4 text-purple-400" />
        <span className="text-xs text-purple-400 font-medium">Call Blitz Active</span>
        <span className="ml-auto text-xs text-white/40 tabular-nums">23:45 remaining</span>
      </div>

      {/* Leaderboard */}
      {reps.map((rep, i) => (
        <div key={i} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
          i === 0 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-white/5"
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            i === 0 ? "bg-yellow-500 text-black" : "bg-white/20 text-white"
          }`}>
            {i + 1}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{rep.name}</span>
              {rep.active && <span className={`w-2 h-2 bg-green-500 rounded-full ${!isMobile ? 'animate-pulse' : ''}`} />}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-white tabular-nums">{rep.calls}</div>
            <div className="text-xs text-white/40">{rep.connects} connects</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Campaigns Demo - shows campaign tracking
function CampaignsDemo() {
  const campaigns = [
    { name: "Q1 Enterprise Outreach", leads: 450, dialed: 312, connected: 89, status: "Active" },
    { name: "Startup Revival", leads: 230, dialed: 180, connected: 42, status: "Active" },
    { name: "Webinar Follow-up", leads: 125, dialed: 125, connected: 31, status: "Complete" },
  ];

  return (
    <div className="space-y-3">
      {campaigns.map((campaign, i) => (
        <div key={i} className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">{campaign.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              campaign.status === "Active"
                ? "bg-green-500/20 text-green-400"
                : "bg-white/10 text-white/50"
            }`}>
              {campaign.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold text-white tabular-nums">{campaign.leads}</div>
              <div className="text-xs text-white/40">Leads</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-400 tabular-nums">{campaign.dialed}</div>
              <div className="text-xs text-white/40">Dialed</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-400 tabular-nums">{campaign.connected}</div>
              <div className="text-xs text-white/40">Connected</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const features: FeatureCard[] = [
  {
    id: "power-dialer",
    title: "Power & Parallel Dialer",
    description: "Auto-dial or call multiple lines simultaneously",
    icon: Zap,
    accentColor: "from-blue-500/20 to-transparent",
    demo: (props) => <PowerDialerDemo {...props} />,
  },
  {
    id: "sales-coach",
    title: "AI Sales Coach",
    description: "Every call scored with coaching insights",
    icon: Headphones,
    accentColor: "from-green-500/20 to-transparent",
    demo: () => <SalesCoachDemo />,
  },
  {
    id: "sales-floor",
    title: "Sales Floor",
    description: "Real-time leaderboards and team blitzes",
    icon: Trophy,
    accentColor: "from-purple-500/20 to-transparent",
    demo: (props) => <SalesFloorDemo {...props} />,
  },
  {
    id: "campaigns",
    title: "Campaigns",
    description: "Track dials and organize outreach",
    icon: Target,
    accentColor: "from-orange-500/20 to-transparent",
    demo: () => <CampaignsDemo />,
  },
];

export default function StackedFeatureCards() {
  const [activeCard, setActiveCard] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobileOrTablet();
  const isVisible = useIsVisible(sectionRef);

  return (
    <section ref={sectionRef} className="py-20 md:py-32 bg-[#0a0a0a] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left side - Stacked cards */}
          <div className="relative order-2 lg:order-1">
            {/* 3D perspective container - disable perspective on mobile */}
            <div
              className="relative h-[500px] sm:h-[540px]"
              style={isMobile ? undefined : { perspective: "1200px" }}
            >
              {features.map((feature, index) => {
                const isActive = index === activeCard;
                const offset = index - activeCard;

                // On mobile, use simple vertical stacking without 3D transforms
                const mobileStyle = {
                  transform: isActive
                    ? "translateY(0)"
                    : offset > 0
                    ? `translateY(${offset * 50}px) scale(${1 - offset * 0.03})`
                    : `translateY(${offset * 30}px)`,
                  opacity: Math.abs(offset) > 2 ? 0 : 1 - Math.abs(offset) * 0.15,
                };

                const desktopStyle = {
                  transform: isActive
                    ? "translateY(0) translateZ(0) rotateX(0)"
                    : offset > 0
                    ? `translateY(${offset * 60}px) translateZ(${-offset * 50}px) rotateX(${offset * 2}deg) scale(${1 - offset * 0.05})`
                    : `translateY(${offset * 40}px) translateZ(${offset * 30}px) scale(${1 + offset * 0.02}) opacity(0.5)`,
                  opacity: Math.abs(offset) > 2 ? 0 : 1 - Math.abs(offset) * 0.2,
                };

                return (
                  <div
                    key={feature.id}
                    onClick={() => setActiveCard(index)}
                    className={`absolute inset-x-0 cursor-pointer transition-all duration-500 ease-out ${
                      isActive ? "z-40" : offset > 0 ? `z-${30 - offset * 10}` : "z-10"
                    }`}
                    style={isMobile ? mobileStyle : desktopStyle}
                  >
                    <div className={`bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
                      isActive ? "border-white/20" : "hover:border-white/15"
                    }`}>
                      {/* Card header with gradient */}
                      <div className={`relative px-6 py-5 border-b border-white/5 bg-gradient-to-r ${feature.accentColor}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                            isActive ? "bg-white text-black" : "bg-white/10 text-white/60"
                          }`}>
                            <feature.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-white">{feature.title}</h3>
                            <p className="text-sm text-white/50">{feature.description}</p>
                          </div>
                          <ChevronRight className={`w-5 h-5 text-white/30 ml-auto transition-transform ${
                            isActive ? "rotate-90" : ""
                          }`} />
                        </div>
                      </div>

                      {/* Card content - demo */}
                      <div className={`transition-all duration-500 ${
                        isActive ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                      } overflow-hidden`}>
                        <div className="p-6">
                          {feature.demo({ isMobile, isVisible })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Card navigation dots */}
            <div className="flex justify-center gap-2 mt-6">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveCard(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === activeCard ? "bg-white w-6" : "bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Right side - Feature list */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-24">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4 tracking-tight text-white">
              Everything you need to close more deals
            </h2>
            <p className="text-white/50 text-base sm:text-lg mb-8 max-w-lg">
              OmniDial combines power dialing, AI coaching, team competitions, and campaign tracking into one platform built for high-velocity sales teams.
            </p>

            <div className="space-y-3">
              {features.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => setActiveCard(index)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 text-left ${
                    index === activeCard
                      ? "border-white/20 bg-white/5"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.02]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    index === activeCard ? "bg-white text-black" : "bg-white/10 text-white/60"
                  }`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white">{feature.title}</h4>
                    <p className="text-sm text-white/40">{feature.description}</p>
                  </div>
                  <ArrowRight className={`w-4 h-4 transition-all ${
                    index === activeCard ? "text-white translate-x-1" : "text-white/20"
                  }`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
