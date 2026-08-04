"use client";

import { Mic, Headphones, BarChart3, Zap, Trophy, Target, GitBranch, Sparkles } from "lucide-react";
import DarkScrollReveal from "./DarkScrollReveal";

// Slack icon as a component for the features grid
const SlackFeatureIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

const features = [
  {
    icon: Zap,
    title: "Power & Parallel Dialer",
    description: "Auto-advance through leads or dial multiple lines simultaneously. 10x your daily volume.",
  },
  {
    icon: Sparkles,
    title: "Enrich",
    description: "Chrome extension and multivendor bulk enrichment. Waterfall through providers to find every number.",
  },
  {
    icon: Headphones,
    title: "AI Sales Coach",
    description: "Every call scored by AI. Get coaching insights, track improvement, identify top performers.",
  },
  {
    icon: Trophy,
    title: "Sales Floor",
    description: "Run call blitzes, track live activity, and drive team competitions with real-time leaderboards.",
  },
  {
    icon: GitBranch,
    title: "Native CRM",
    description: "Built-in pipeline management. Track leads through stages from prospect to close.",
  },
  {
    icon: Target,
    title: "Campaigns",
    description: "Create targeted outreach campaigns. Track dials, measure results, and manage lead distribution.",
  },
  {
    icon: Mic,
    title: "Call Recording",
    description: "Every call recorded and transcribed. Search, playback, and share clips for coaching.",
  },
  {
    icon: "slack" as const,
    title: "Slack Integration",
    description: "Get real-time call notifications, deal alerts, and team updates directly in your Slack workspace.",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Connect rates, talk time, dispositions. Activity feeds and performance dashboards.",
  },
];

export default function DarkFeaturesGrid() {
  return (
    <section id="features" className="py-12 sm:py-16 md:py-20 lg:py-28 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <DarkScrollReveal>
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight mb-3 sm:mb-4 text-white"
            >
              Everything you need to sell smarter
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto text-sm sm:text-base font-light">
              Two products, one platform. Enrich your leads, then dial them with AI coaching, team competitions, and built-in CRM.
            </p>
          </div>
        </DarkScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, i) => (
            <DarkScrollReveal key={i} delay={i * 80}>
              <div className="bg-[#111111] rounded-2xl p-6 border border-white/5 hover:border-white/10 hover:bg-[#151515] transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/60 mb-5 group-hover:bg-white group-hover:text-black transition-colors">
                  {feature.icon === "slack" ? (
                    <SlackFeatureIcon className="w-6 h-6" />
                  ) : (
                    <feature.icon className="w-6 h-6" />
                  )}
                </div>
                <h3 className="font-medium text-lg mb-2 text-white">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            </DarkScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
