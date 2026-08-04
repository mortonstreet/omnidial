"use client";

import { useState } from "react";
import { Phone, Mic, Zap, BarChart3, Play } from "lucide-react";

const features = [
  {
    id: "dialer",
    title: "Power Dialer",
    description: "Auto-dial through your list without lifting a finger",
    icon: Zap,
    demo: {
      type: "sequence",
      contacts: [
        { name: "Sarah Chen", company: "Acme Corp", status: "Connected", duration: "2:34" },
        { name: "Mike Johnson", company: "TechStart", status: "No Answer", duration: "0:00" },
        { name: "Lisa Park", company: "GrowthCo", status: "Voicemail", duration: "0:45" },
        { name: "David Kim", company: "ScaleUp", status: "Queued", duration: "--:--" },
      ],
    },
  },
  {
    id: "recording",
    title: "Call Recording",
    description: "Every conversation captured, transcribed, and searchable",
    icon: Mic,
    demo: {
      type: "waveform",
      transcript: [
        { speaker: "You", text: "Hi Sarah, this is Alex from OmniDial..." },
        { speaker: "Sarah", text: "Hi Alex, yes I've been looking at your product." },
        { speaker: "You", text: "Great! I'd love to show you how our power dialer..." },
      ],
    },
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Track every metric that matters for your team",
    icon: BarChart3,
    demo: {
      type: "stats",
      metrics: [
        { label: "Connect Rate", value: "34%", trend: "+5%" },
        { label: "Calls Today", value: "147", trend: "+23" },
        { label: "Avg Talk Time", value: "2:45", trend: "+0:12" },
        { label: "Meetings Set", value: "8", trend: "+2" },
      ],
    },
  },
  {
    id: "crm",
    title: "Built-in CRM",
    description: "Pipeline, notes, and history in one place",
    icon: Phone,
    demo: {
      type: "pipeline",
      stages: [
        { name: "New", count: 24, color: "bg-blue-500" },
        { name: "Contacted", count: 18, color: "bg-yellow-500" },
        { name: "Qualified", count: 12, color: "bg-green-500" },
        { name: "Won", count: 6, color: "bg-white" },
      ],
    },
  },
];

// Pre-generate static waveform heights to avoid impure function during render
const STATIC_WAVEFORM_HEIGHTS = [
  28, 15, 32, 22, 18, 26, 12, 30, 24, 16,
  20, 29, 14, 25, 19, 31, 13, 27, 21, 17,
  23, 11, 28, 16, 30, 22, 14, 26, 18, 32,
  20, 24, 12, 29, 15, 27, 21, 19, 31, 25
];

export default function DarkFeatureShowcase() {
  const [activeFeature, setActiveFeature] = useState(features[0]);

  return (
    <section className="py-20 md:py-32 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left side - Interactive demo */}
          <div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-3 sm:mb-4 tracking-tight text-white">
              {activeFeature.title}
            </h2>
            <p className="text-white/50 text-base sm:text-lg mb-6 sm:mb-8">
              {activeFeature.description}
            </p>

            {/* Demo block */}
            <div className="bg-[#111111] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/5">
              {/* Demo header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-2 text-xs text-white/30">OmniDial</span>
              </div>

              {/* Demo content */}
              <div className="p-4 sm:p-6">
                {activeFeature.demo.type === "sequence" && (
                  <div className="space-y-2">
                    {activeFeature.demo.contacts?.map((contact, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          contact.status === "Connected"
                            ? "bg-green-500/10 border border-green-500/20"
                            : contact.status === "Queued"
                            ? "bg-white/5"
                            : "bg-transparent"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          contact.status === "Connected"
                            ? "bg-green-500 text-black"
                            : "bg-white/10 text-white"
                        }`}>
                          {contact.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-white truncate">{contact.name}</div>
                          <div className="text-xs text-white/40 truncate">{contact.company}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-medium ${
                            contact.status === "Connected" ? "text-green-400" :
                            contact.status === "No Answer" ? "text-red-400" :
                            contact.status === "Voicemail" ? "text-yellow-400" :
                            "text-white/40"
                          }`}>
                            {contact.status}
                          </div>
                          <div className="text-xs text-white/30">{contact.duration}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeFeature.demo.type === "waveform" && (
                  <div className="space-y-4">
                    {/* Waveform visualization */}
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                      <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black">
                        <Play className="w-4 h-4 ml-0.5" />
                      </button>
                      <div className="flex-1 flex items-center gap-0.5">
                        {STATIC_WAVEFORM_HEIGHTS.map((height, i) => (
                          <div
                            key={i}
                            className="w-1 bg-white/40 rounded-full"
                            style={{
                              height: `${height}px`,
                              opacity: i < 15 ? 1 : 0.4,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-white/40">2:34</span>
                    </div>
                    {/* Transcript */}
                    <div className="space-y-3 pt-2">
                      {activeFeature.demo.transcript?.map((line, i) => (
                        <div key={i} className={`flex gap-3 ${line.speaker === "You" ? "" : "flex-row-reverse"}`}>
                          <div className={`px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                            line.speaker === "You"
                              ? "bg-blue-500/20 text-blue-100"
                              : "bg-white/10 text-white/80"
                          }`}>
                            <span className="text-xs text-white/40 block mb-1">{line.speaker}</span>
                            {line.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeFeature.demo.type === "stats" && (
                  <div className="grid grid-cols-2 gap-4">
                    {activeFeature.demo.metrics?.map((metric, i) => (
                      <div key={i} className="p-4 bg-white/5 rounded-lg">
                        <div className="text-xs text-white/40 mb-1">{metric.label}</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold text-white">{metric.value}</span>
                          <span className="text-xs text-green-400">{metric.trend}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeFeature.demo.type === "pipeline" && (
                  <div className="space-y-4">
                    {activeFeature.demo.stages?.map((stage, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-white/50">{stage.name}</div>
                        <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${stage.color} rounded-full transition-all duration-500`}
                            style={{ width: `${(stage.count / 24) * 100}%` }}
                          />
                        </div>
                        <div className="w-8 text-right text-sm font-medium text-white">{stage.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Feature cards */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 lg:space-y-6 lg:gap-0">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature)}
                className={`w-full text-left p-4 sm:p-6 rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                  activeFeature.id === feature.id
                    ? "border-white/20 bg-white/5 shadow-lg"
                    : "border-white/5 hover:border-white/10 hover:bg-white/[0.02] bg-transparent"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                    activeFeature.id === feature.id
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/60"
                  }`}>
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1 text-white">{feature.title}</h3>
                    <p className="text-white/50 text-xs sm:text-sm line-clamp-2">{feature.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
