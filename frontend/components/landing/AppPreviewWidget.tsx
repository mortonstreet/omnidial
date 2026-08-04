"use client";

import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, BarChart3, Zap } from "lucide-react";

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

// Slack icon component
const SlackIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

// Mini dialer preview that looks like the actual app
function DialerPreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [callState, setCallState] = useState<"idle" | "ringing" | "connected" | "ended">("connected");
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // On mobile or when not visible, show static connected state
    if (isMobile || !isVisible) {
      setCallState("connected");
      setDuration(127);
      return;
    }

    // Simulate a call cycle
    const cycle = async () => {
      setCallState("idle");
      setDuration(0);
      await new Promise(r => setTimeout(r, 1500));

      setCallState("ringing");
      await new Promise(r => setTimeout(r, 2000));

      setCallState("connected");
      // Count up during connected state
      let d = 0;
      const timer = setInterval(() => {
        d++;
        setDuration(d);
      }, 1000);

      await new Promise(r => setTimeout(r, 5000));
      clearInterval(timer);

      setCallState("ended");
      await new Promise(r => setTimeout(r, 2000));
    };

    cycle();
    const interval = setInterval(cycle, 12000);
    return () => clearInterval(interval);
  }, [isMobile, isVisible]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">Power Dialer</span>
        <div className="flex items-center gap-1.5 text-green-400">
          <span className={`w-1.5 h-1.5 bg-green-400 rounded-full ${!isMobile ? 'animate-pulse' : ''}`} />
          Active
        </div>
      </div>

      {/* Contact info */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
          callState === "connected" ? "bg-green-500 text-black" : "bg-white/10 text-white"
        }`}>
          JH
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm">Jensen Huang</div>
          <div className="text-xs text-white/40">NVIDIA - CEO</div>
        </div>
      </div>

      {/* Call status */}
      <div className="text-center py-2">
        <div className={`text-3xl font-mono transition-colors ${
          callState === "connected" ? "text-green-400" : "text-white"
        }`}>
          {callState === "idle" && "--:--"}
          {callState === "ringing" && (
            <span className={`text-yellow-400 ${!isMobile ? 'animate-pulse' : ''}`}>Ringing...</span>
          )}
          {callState === "connected" && formatTime(duration)}
          {callState === "ended" && formatTime(duration)}
        </div>
        <div className="text-xs text-white/40 mt-1 capitalize">
          {callState === "ended" ? "Call ended" : callState.replace("-", " ")}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button className={`p-3 rounded-lg transition-colors ${
          callState === "connected"
            ? "bg-white/10 text-white"
            : "bg-white/5 text-white/30"
        }`}>
          <Mic className="w-4 h-4" />
        </button>
        <button className={`p-4 rounded-xl transition-all ${
          callState === "connected"
            ? "bg-red-500 text-white"
            : callState === "ringing"
            ? `bg-yellow-500 text-black ${!isMobile ? 'animate-pulse' : ''}`
            : "bg-green-500 text-white"
        }`}>
          {callState === "connected" ? (
            <PhoneOff className="w-5 h-5" />
          ) : (
            <Phone className="w-5 h-5" />
          )}
        </button>
        <button className={`p-3 rounded-lg transition-colors ${
          callState === "connected"
            ? "bg-white/10 text-white"
            : "bg-white/5 text-white/30"
        }`}>
          <Zap className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Mini stats preview with Slack notification
function StatsPreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [animatedShowSlackNotif, setAnimatedShowSlackNotif] = useState(true);

  useEffect(() => {
    // On mobile or when not visible, skip animation
    if (isMobile || !isVisible) {
      return;
    }

    // Show Slack notification periodically
    const cycle = async () => {
      setAnimatedShowSlackNotif(false);
      await new Promise(r => setTimeout(r, 4000));
      setAnimatedShowSlackNotif(true);
      await new Promise(r => setTimeout(r, 3000));
    };
    cycle();
    const interval = setInterval(cycle, 8000);
    return () => clearInterval(interval);
  }, [isMobile, isVisible]);

  // On mobile or when not visible, always show the notification (static state)
  const showSlackNotif = (isMobile || !isVisible) ? true : animatedShowSlackNotif;

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Today&apos;s Stats</span>
        <BarChart3 className="w-3.5 h-3.5 text-white/30" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-white/40 font-light">Calls</div>
          <div className="text-xl font-medium text-white">147</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-white/40 font-light">Connect</div>
          <div className="text-xl font-medium text-green-400">34%</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-white/40 font-light">Talk Time</div>
          <div className="text-xl font-medium text-white">2:45</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-white/40 font-light">Meetings</div>
          <div className="text-xl font-medium text-blue-400">8</div>
        </div>
      </div>

      {/* Slack notification */}
      <div className={`transition-all duration-500 overflow-hidden ${showSlackNotif ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-[#4A154B]/20 border border-[#4A154B]/30 rounded-lg p-2 flex items-center gap-2">
          <SlackIcon className="w-4 h-4 text-[#E01E5A]" />
          <span className="text-[10px] text-white/70 font-light">Deal alert posted to #sales-wins</span>
        </div>
      </div>
    </div>
  );
}

// Mini queue preview
function QueuePreview({ isMobile }: { isMobile: boolean }) {
  const leads = [
    { name: "Tim Cook", company: "Apple", status: "called" },
    { name: "Satya Nadella", company: "Microsoft", status: "called" },
    { name: "Jensen Huang", company: "NVIDIA", status: "current" },
    { name: "Sundar Pichai", company: "Google", status: "queued" },
    { name: "Mark Zuckerberg", company: "Meta", status: "queued" },
  ];

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Dial Queue</span>
        <span className="text-xs text-white/30">3/5 remaining</span>
      </div>

      <div className="space-y-1.5">
        {leads.map((lead, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
              lead.status === "current"
                ? "bg-green-500/10 border border-green-500/20"
                : lead.status === "called"
                ? "opacity-40"
                : "bg-white/5"
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
              lead.status === "current" ? "bg-green-500 text-black" : "bg-white/10 text-white"
            }`}>
              {lead.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white truncate">{lead.name}</div>
            </div>
            {lead.status === "current" && (
              <div className={`w-1.5 h-1.5 bg-green-400 rounded-full ${!isMobile ? 'animate-pulse' : ''}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AppPreviewWidget() {
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobileOrTablet();
  const isVisible = useIsVisible(sectionRef);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-[#0a0a0a] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-4 tracking-tight text-white">
            See it in action
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto font-light">
            A glimpse of the OmniDial experience. Every feature designed for speed and efficiency.
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
                  app.omnidial.io
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
                    Dialer
                  </button>
                  <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition-colors">
                    CRM
                  </button>
                </div>
              </div>

              {/* App layout */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <QueuePreview isMobile={isMobile} />
                </div>
                <div className="md:col-span-1">
                  <DialerPreview isMobile={isMobile} isVisible={isVisible} />
                </div>
                <div className="md:col-span-1">
                  <StatsPreview isMobile={isMobile} isVisible={isVisible} />
                </div>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
