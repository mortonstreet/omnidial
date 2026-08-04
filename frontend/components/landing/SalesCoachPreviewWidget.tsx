"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, TrendingUp, MessageSquare, Lightbulb, Volume2, VolumeX, Brain } from "lucide-react";

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

// Live coaching tips that appear during calls
function CoachingTipsPreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const tips = [
    { type: "objection", text: "Prospect mentioned budget concerns. Try: \"I understand. Most of our clients initially felt the same way, but found the ROI justified the investment within 3 months.\"", icon: MessageSquare },
    { type: "opportunity", text: "Great opening! They seem engaged. Ask about their current pain points.", icon: Lightbulb },
    { type: "warning", text: "You've been talking for 45 seconds. Pause and ask an open-ended question.", icon: Volume2 },
    { type: "success", text: "Perfect handling of that objection! They're warming up.", icon: TrendingUp },
  ];

  const [animatedVisibleTips, setAnimatedVisibleTips] = useState<number[]>([0, 1]);
  const tipIndexRef = useRef(2);

  const showTip = useCallback(() => {
    setAnimatedVisibleTips(prev => {
      const newTips = [...prev, tipIndexRef.current];
      // Keep only last 3 tips
      return newTips.slice(-3);
    });
    tipIndexRef.current = (tipIndexRef.current + 1) % tips.length;
  }, [tips.length]);

  useEffect(() => {
    // On mobile or when not visible, skip animation
    if (isMobile || !isVisible) {
      return;
    }

    // Show first tip
    showTip();

    const interval = setInterval(showTip, 3500);

    // Reset periodically
    const resetInterval = setInterval(() => {
      setAnimatedVisibleTips([]);
      tipIndexRef.current = 0;
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(resetInterval);
    };
  }, [showTip, isMobile, isVisible]);

  // On mobile or when not visible, show static tips
  const visibleTips = (isMobile || !isVisible) ? [0, 1] : animatedVisibleTips;

  const getTipStyle = (type: string) => {
    switch (type) {
      case "objection": return "border-yellow-500/30 bg-yellow-500/5";
      case "opportunity": return "border-green-500/30 bg-green-500/5";
      case "warning": return "border-orange-500/30 bg-orange-500/5";
      case "success": return "border-blue-500/30 bg-blue-500/5";
      default: return "border-white/10 bg-white/5";
    }
  };

  const getTipIconColor = (type: string) => {
    switch (type) {
      case "objection": return "text-yellow-400 bg-yellow-400/10";
      case "opportunity": return "text-green-400 bg-green-400/10";
      case "warning": return "text-orange-400 bg-orange-400/10";
      case "success": return "text-blue-400 bg-blue-400/10";
      default: return "text-white/40 bg-white/10";
    }
  };

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-white/50">AI Coach</span>
        </div>
        <div className="flex items-center gap-1.5 text-green-400 text-xs">
          <span className={`w-1.5 h-1.5 bg-green-400 rounded-full ${!isMobile ? 'animate-pulse' : ''}`} />
          Listening
        </div>
      </div>

      <div className="space-y-2 min-h-[200px]">
        {visibleTips.map((tipIdx, i) => {
          const tip = tips[tipIdx];
          const Icon = tip.icon;
          return (
            <div
              key={`${tipIdx}-${i}`}
              className={`p-3 rounded-lg border transition-all duration-500 animate-in slide-in-from-right-5 ${getTipStyle(tip.type)}`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getTipIconColor(tip.type)}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-white/80 leading-relaxed">{tip.text}</p>
              </div>
            </div>
          );
        })}
        {visibleTips.length === 0 && (
          <div className="flex items-center justify-center h-[200px] text-white/30 text-sm">
            <Brain className={`w-5 h-5 mr-2 ${!isMobile ? 'animate-pulse' : ''}`} />
            Analyzing conversation...
          </div>
        )}
      </div>
    </div>
  );
}

// Call score with animated gauge
function CallScorePreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [animatedScore, setAnimatedScore] = useState(78);
  const [targetScore, setTargetScore] = useState(78);

  useEffect(() => {
    // On mobile or when not visible, skip animation
    if (isMobile || !isVisible) {
      return;
    }

    // Animate score on mount
    const animateScore = () => {
      let current = 0;
      const interval = setInterval(() => {
        current += 2;
        if (current >= targetScore) {
          setAnimatedScore(targetScore);
          clearInterval(interval);
        } else {
          setAnimatedScore(current);
        }
      }, 30);
      return interval;
    };

    const interval = animateScore();

    // Periodically update score
    const updateInterval = setInterval(() => {
      const newTarget = Math.floor(Math.random() * 20) + 70;
      setTargetScore(newTarget);
      setAnimatedScore(prev => {
        const diff = newTarget - prev;
        return prev + Math.sign(diff) * Math.min(Math.abs(diff), 5);
      });
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(updateInterval);
    };
  }, [targetScore, isMobile, isVisible]);

  // On mobile or when not visible, show static score
  const score = (isMobile || !isVisible) ? 78 : animatedScore;

  const getScoreColor = () => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Call Score</span>
        <TrendingUp className="w-3.5 h-3.5 text-white/30" />
      </div>

      <div className="text-center py-4">
        <div className="relative inline-flex items-center justify-center">
          {/* Circular progress background */}
          <svg className="w-24 h-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-white/10"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 251.2} 251.2`}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" className={`${score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500"}`} stopColor="currentColor" />
                <stop offset="100%" className={`${score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400"}`} stopColor="currentColor" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums ${getScoreColor()}`}>{score}</span>
          </div>
        </div>
        <div className="text-xs text-white/40 mt-2">
          {score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs work"}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Engagement</span>
          <span className="text-green-400">High</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Clarity</span>
          <span className="text-green-400">Good</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Pacing</span>
          <span className="text-yellow-400">Adjust</span>
        </div>
      </div>
    </div>
  );
}

// Talk/Listen ratio visualization
function TalkRatioPreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [talkRatio, setTalkRatio] = useState(45);
  const [bars, setBars] = useState<{ height: number; isYou: boolean }[]>(() =>
    Array.from({ length: 20 }, () => ({
      height: Math.random() * 60 + 20,
      isYou: Math.random() > 0.4,
    }))
  );

  useEffect(() => {
    // On mobile or when not visible, show static state
    if (isMobile || !isVisible) return;

    // Animate new bars
    const interval = setInterval(() => {
      setBars(prev => {
        const newBar = {
          height: Math.random() * 60 + 20,
          isYou: Math.random() > 0.45,
        };
        const updated = [...prev.slice(1), newBar];

        // Calculate new talk ratio
        const youBars = updated.filter(b => b.isYou).length;
        setTalkRatio(Math.round((youBars / updated.length) * 100));

        return updated;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [isMobile, isVisible]);

  const isIdeal = talkRatio >= 35 && talkRatio <= 50;

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Talk/Listen Ratio</span>
        {talkRatio > 50 ? (
          <Volume2 className="w-3.5 h-3.5 text-yellow-400" />
        ) : (
          <VolumeX className="w-3.5 h-3.5 text-green-400" />
        )}
      </div>

      {/* Waveform visualization */}
      <div className="flex items-end gap-0.5 h-16 px-1">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-all duration-300 ${
              bar.isYou ? "bg-blue-400" : "bg-green-400/60"
            }`}
            style={{ height: `${bar.height}%` }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs text-white/50">You</span>
        </div>
        <span className={`text-xl font-semibold tabular-nums ${isIdeal ? "text-green-400" : "text-yellow-400"}`}>
          {talkRatio}%
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">Prospect</span>
          <div className="w-2 h-2 rounded-full bg-green-400/60" />
        </div>
      </div>

      <div className={`text-center text-[10px] py-1 px-2 rounded ${
        isIdeal ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
      }`}>
        {isIdeal ? "Great balance! Keep listening." : "Try asking more questions"}
      </div>
    </div>
  );
}

export default function SalesCoachPreviewWidget() {
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobileOrTablet();
  const isVisible = useIsVisible(sectionRef);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-[#0a0a0a] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-4 tracking-tight text-white">
            Your AI sales coach
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto font-light">
            Real-time guidance during calls. Get coached on objections, pacing, and engagement without leaving the dialer.
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
                  app.omnidial.io/coach
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
                    Dialer
                  </button>
                  <button className="px-3 py-1.5 text-xs bg-white/10 text-white rounded-md flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    Sales Coach
                  </button>
                  <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition-colors">
                    Analytics
                  </button>
                </div>
              </div>

              {/* App layout */}
              <div className="grid md:grid-cols-3 gap-4">
                <CoachingTipsPreview isMobile={isMobile} isVisible={isVisible} />
                <div className="space-y-4">
                  <CallScorePreview isMobile={isMobile} isVisible={isVisible} />
                  <TalkRatioPreview isMobile={isMobile} isVisible={isVisible} />
                </div>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
