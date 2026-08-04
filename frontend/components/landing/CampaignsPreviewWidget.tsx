"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, Plus, Users, Target, Rocket, CheckCircle2, Clock } from "lucide-react";

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

// Campaign list with animated status changes
function CampaignListPreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [campaigns, setCampaigns] = useState([
    { id: 1, name: "Fortune 500 CTO Outreach", status: "active", leads: 156, completed: 89, color: "green" },
    { id: 2, name: "Series B+ Founders", status: "paused", leads: 234, completed: 234, color: "yellow" },
    { id: 3, name: "NVIDIA Partner Network", status: "active", leads: 45, completed: 12, color: "green" },
    { id: 4, name: "Big Tech VP Pipeline", status: "completed", leads: 89, completed: 89, color: "blue" },
  ]);

  const [animatingId, setAnimatingId] = useState<number | null>(null);

  useEffect(() => {
    // Disable animation on mobile or when not visible
    if (isMobile || !isVisible) return;

    // Simulate campaign progress
    const interval = setInterval(() => {
      setCampaigns(prev => prev.map(c => {
        if (c.status === "active" && c.completed < c.leads) {
          const newCompleted = Math.min(c.completed + Math.floor(Math.random() * 3) + 1, c.leads);
          if (newCompleted !== c.completed) {
            setAnimatingId(c.id);
            setTimeout(() => setAnimatingId(null), 300);
          }
          return { ...c, completed: newCompleted };
        }
        return c;
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [isMobile, isVisible]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Play className="w-3 h-3" />;
      case "paused": return <Pause className="w-3 h-3" />;
      case "completed": return <CheckCircle2 className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-400 bg-green-400/10";
      case "paused": return "text-yellow-400 bg-yellow-400/10";
      case "completed": return "text-blue-400 bg-blue-400/10";
      default: return "text-white/40 bg-white/5";
    }
  };

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3 flex-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Campaigns</span>
        <button className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors">
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      <div className="space-y-2">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className={`p-3 rounded-lg bg-white/5 border border-transparent transition-all duration-300 ${
              animatingId === campaign.id ? "border-green-500/30 bg-green-500/5" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white font-medium truncate flex-1 mr-2">
                {campaign.name}
              </span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${getStatusColor(campaign.status)}`}>
                {getStatusIcon(campaign.status)}
                <span className="capitalize">{campaign.status}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    campaign.status === "completed" ? "bg-blue-400" :
                    campaign.status === "active" ? "bg-green-400" : "bg-yellow-400"
                  }`}
                  style={{ width: `${(campaign.completed / campaign.leads) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-white/40 tabular-nums">
                {campaign.completed}/{campaign.leads}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Campaign creation flow animation
function CampaignCreatorPreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [animatedStep, setAnimatedStep] = useState<"name" | "leads" | "launch" | "active">("active");
  const [animatedTypedName, setAnimatedTypedName] = useState("AI Chip Executives");
  const [animatedLeadCount, setAnimatedLeadCount] = useState(127);
  const campaignName = "AI Chip Executives";

  useEffect(() => {
    // On mobile or when not visible, skip animation
    if (isMobile || !isVisible) {
      return;
    }

    const runAnimation = async () => {
      // Reset
      setAnimatedStep("name");
      setAnimatedTypedName("");
      setAnimatedLeadCount(0);
      await new Promise(r => setTimeout(r, 1000));

      // Type name
      for (let i = 0; i <= campaignName.length; i++) {
        setAnimatedTypedName(campaignName.slice(0, i));
        await new Promise(r => setTimeout(r, 80));
      }
      await new Promise(r => setTimeout(r, 800));

      // Add leads
      setAnimatedStep("leads");
      for (let i = 0; i <= 127; i += 7) {
        setAnimatedLeadCount(Math.min(i, 127));
        await new Promise(r => setTimeout(r, 50));
      }
      setAnimatedLeadCount(127);
      await new Promise(r => setTimeout(r, 1000));

      // Launch
      setAnimatedStep("launch");
      await new Promise(r => setTimeout(r, 1500));

      // Active
      setAnimatedStep("active");
      await new Promise(r => setTimeout(r, 3000));
    };

    runAnimation();
    const interval = setInterval(runAnimation, 12000);
    return () => clearInterval(interval);
  }, [isMobile, isVisible]);

  // On mobile or when not visible, use static active state
  const step = (isMobile || !isVisible) ? "active" : animatedStep;
  const typedName = (isMobile || !isVisible) ? campaignName : animatedTypedName;
  const leadCount = (isMobile || !isVisible) ? 127 : animatedLeadCount;

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">
          {step === "active" ? "Campaign Active" : "Create Campaign"}
        </span>
        {step === "active" && (
          <div className="flex items-center gap-1.5 text-green-400">
            <span className={`w-1.5 h-1.5 bg-green-400 rounded-full ${!isMobile ? 'animate-pulse' : ''}`} />
            Running
          </div>
        )}
      </div>

      {step === "name" && (
        <div className="space-y-3">
          <div className="text-sm text-white/60">Campaign Name</div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <span className="text-white">{typedName}</span>
            <span className={`inline-block w-0.5 h-4 bg-green-400 ml-0.5 ${!isMobile ? 'animate-pulse' : ''}`} />
          </div>
        </div>
      )}

      {step === "leads" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white">{campaignName}</span>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-white tabular-nums">{leadCount}</div>
                <div className="text-xs text-white/40">leads imported</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "launch" && (
        <div className="space-y-3">
          <div className="text-sm text-white">{campaignName}</div>
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-3">
              <Rocket className={`w-8 h-8 text-green-400 ${!isMobile ? 'animate-bounce' : ''}`} />
            </div>
            <div className="text-lg font-medium text-white">Launching...</div>
            <div className="text-xs text-white/40 mt-1">127 leads queued</div>
          </div>
        </div>
      )}

      {step === "active" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
              <Target className="w-5 h-5 text-black" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">{campaignName}</div>
              <div className="text-xs text-white/40">127 leads • Auto-dialing</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-white">12</div>
              <div className="text-[10px] text-white/40">Dialed</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-green-400">4</div>
              <div className="text-[10px] text-white/40">Connected</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-blue-400">1</div>
              <div className="text-[10px] text-white/40">Meetings</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Campaign stats overview
function CampaignStatsPreview() {
  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Campaign Performance</span>
        <Target className="w-3.5 h-3.5 text-white/30" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Active Campaigns</span>
          <span className="text-xl font-semibold text-white">4</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Total Leads</span>
          <span className="text-xl font-semibold text-white">524</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Avg Connect Rate</span>
          <span className="text-xl font-semibold text-green-400">31%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Meetings This Week</span>
          <span className="text-xl font-semibold text-blue-400">23</span>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPreviewWidget() {
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobileOrTablet();
  const isVisible = useIsVisible(sectionRef);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-[#0a0a0a] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-4 tracking-tight text-white">
            Campaigns that scale
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto font-light">
            Organize your outreach into focused campaigns. Track progress, measure results, and iterate fast.
          </p>
        </div>

        {/* App preview mockup */}
        <div className="relative">
          {/* Browser chrome mockup */}
          <div className="bg-[#111111] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            {/* Window controls */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0f0f0f]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-white/5 rounded-md text-xs text-white/40">
                  app.omnidial.io/campaigns
                </div>
              </div>
              <div className="w-12" />
            </div>

            {/* App content */}
            <div className="p-4 sm:p-6">
              {/* App header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    {/* Bold forward slash */}
                    <path d="M17 2L7 22" stroke="white" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  <span className="font-medium tracking-tight text-white">OmniDial</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition-colors">
                    Dashboard
                  </button>
                  <button className="px-3 py-1.5 text-xs bg-white/10 text-white rounded-md">
                    Campaigns
                  </button>
                  <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition-colors">
                    CRM
                  </button>
                </div>
              </div>

              {/* App layout */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <CampaignListPreview isMobile={isMobile} isVisible={isVisible} />
                </div>
                <div className="md:col-span-1">
                  <CampaignCreatorPreview isMobile={isMobile} isVisible={isVisible} />
                </div>
                <div className="md:col-span-1">
                  <CampaignStatsPreview />
                </div>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
