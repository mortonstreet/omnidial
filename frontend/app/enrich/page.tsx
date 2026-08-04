"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Chrome,
  Upload,
  Database,
  Layers,
  Check,
  ChevronDown,
  Zap,
  Shield,
  ArrowDownToLine,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import DarkScrollReveal from "@/components/landing/DarkScrollReveal";
import DarkFooter from "@/components/landing/DarkFooter";
import { OmniDialLogoStatic } from "@/components/landing/OmniDialLogo";

/* ─── Vendor data ─── */
const vendors = [
  { key: "apollo", name: "Apollo.io", color: "#6C5CE7", description: "B2B contact & company data" },
  { key: "zoominfo", name: "ZoomInfo", color: "#00B4D8", description: "Enterprise B2B intelligence" },
  { key: "clearbit", name: "Clearbit", color: "#5352ED", description: "Real-time enrichment API" },
  { key: "lusha", name: "Lusha", color: "#FF6B6B", description: "Direct dial & email finder" },
  { key: "prospeo", name: "Prospeo", color: "#FDCB6E", description: "Email & LinkedIn enrichment" },
];

/* ─── CRM data ─── */
const crms = [
  { name: "HubSpot", color: "#FF7A59", letter: "H" },
  { name: "Salesforce", color: "#00A1E0", letter: "S" },
  { name: "Attio", color: "#5856D6", letter: "A" },
];

/* ─── Features ─── */
const features = [
  {
    icon: Chrome,
    title: "Chrome Extension",
    headline: "1-click enrich from LinkedIn",
    description:
      "Visit any LinkedIn profile and instantly find verified phone numbers and email addresses. No tab switching, no copy-paste.",
    badge: "Extension",
  },
  {
    icon: Upload,
    title: "Bulk CSV Upload",
    headline: "Enrich thousands in minutes",
    description:
      "Upload a CSV with names and companies. Our auto-mapper detects columns, enriches every row through the waterfall, and exports clean data.",
    badge: "Bulk",
  },
  {
    icon: Layers,
    title: "Waterfall Enrichment",
    headline: "6 vendors, one request",
    description:
      "Each lead cascades through every vendor until a phone or email is found. Better coverage than any single provider alone.",
    badge: "Waterfall",
  },
  {
    icon: Database,
    title: "Multi-CRM Push",
    headline: "Push to any CRM instantly",
    description:
      "Send enriched leads to HubSpot, Salesforce, or Attio with one click. Supports bulk push for entire CSV uploads.",
    badge: "CRM",
  },
];

/* ─── Animated waterfall diagram ─── */
function WaterfallDiagram() {
  const [activeStep, setActiveStep] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveStep((s) => (s + 1) % (vendors.length + 2));
    }, 1800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // step 0 = lead input, steps 1-6 = vendors, step 7 = result
  const isInputActive = activeStep === 0;
  const isResultActive = activeStep === vendors.length + 1;

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Input node */}
      <div
        className={`mx-auto w-fit px-6 py-3 rounded-xl border transition-all duration-500 ${
          isInputActive
            ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.15)]"
            : "bg-[#111111] border-white/10"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-500 ${
              isInputActive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40"
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
          </div>
          <div>
            <p className={`text-sm font-medium transition-colors duration-500 ${isInputActive ? "text-white" : "text-white/60"}`}>
              Lead Input
            </p>
            <p className="text-xs text-white/30">Name + Company</p>
          </div>
        </div>
      </div>

      {/* Connector line */}
      <div className="flex justify-center py-1">
        <div className="w-px h-5 bg-white/10" />
      </div>

      {/* Vendor cascade */}
      <div className="space-y-2">
        {vendors.map((vendor, i) => {
          const isActive = activeStep === i + 1;
          const isPast = activeStep > i + 1;
          const isMiss = isPast && i < vendors.length - 1;
          const isHit = isPast && i === vendors.length - 1;

          return (
            <div key={vendor.key}>
              <div
                className={`relative mx-auto w-full max-w-md px-5 py-3 rounded-xl border transition-all duration-500 ${
                  isActive
                    ? "border-white/20 bg-[#161616] shadow-[0_0_20px_rgba(255,255,255,0.04)]"
                    : "border-white/5 bg-[#111111]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: isActive ? vendor.color : isPast ? (isHit ? "#10B981" : "#ffffff15") : "#ffffff10",
                        boxShadow: isActive ? `0 0 8px ${vendor.color}60` : "none",
                      }}
                    />
                    <span
                      className={`text-sm font-medium transition-colors duration-500 ${
                        isActive ? "text-white" : "text-white/50"
                      }`}
                    >
                      {vendor.name}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full transition-all duration-500 ${
                      isActive
                        ? "bg-yellow-500/15 text-yellow-400"
                        : isMiss
                          ? "bg-white/5 text-white/25"
                          : isHit
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-transparent text-transparent"
                    }`}
                  >
                    {isActive ? "Querying..." : isMiss ? "No data" : isHit ? "Match found" : "\u00A0"}
                  </span>
                </div>
              </div>
              {i < vendors.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ChevronDown
                    className={`w-3 h-3 transition-colors duration-500 ${
                      isPast ? "text-white/20" : "text-white/8"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Connector line */}
      <div className="flex justify-center py-1">
        <div className="w-px h-5 bg-white/10" />
      </div>

      {/* Result node */}
      <div
        className={`mx-auto w-fit px-6 py-3 rounded-xl border transition-all duration-500 ${
          isResultActive
            ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.15)]"
            : "bg-[#111111] border-white/10"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-500 ${
              isResultActive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40"
            }`}
          >
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className={`text-sm font-medium transition-colors duration-500 ${isResultActive ? "text-emerald-400" : "text-white/60"}`}>
              Enriched Lead
            </p>
            <p className="text-xs text-white/30">Phone + Email found</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sticky nav ─── */
function EnrichSiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <OmniDialLogoStatic size={24} color="#10B981" />
          <span className="text-white font-medium text-sm tracking-tight">
            Enrich <span className="text-white/40 font-normal">by OmniDial</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="#features"
            className="px-3 py-1.5 text-sm text-white/50 hover:text-white transition-colors"
          >
            Features
          </Link>
          <Link
            href="#waterfall"
            className="px-3 py-1.5 text-sm text-white/50 hover:text-white transition-colors"
          >
            Waterfall
          </Link>
          <Link
            href="#vendors"
            className="px-3 py-1.5 text-sm text-white/50 hover:text-white transition-colors"
          >
            Vendors
          </Link>
          <div className="w-px h-5 bg-white/10 mx-2" />
          <Link
            href="#chrome-extension"
            className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
          >
            <span className="flex items-center gap-2">
              <Chrome className="w-3.5 h-3.5" />
              Install Extension
            </span>
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            Sign Up Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-white/5 text-white/60"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0a0a0a] border-t border-white/5 px-4 pb-6 pt-2 space-y-3">
          <Link href="#features" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-white/60 hover:text-white">Features</Link>
          <Link href="#waterfall" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-white/60 hover:text-white">Waterfall</Link>
          <Link href="#vendors" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-white/60 hover:text-white">Vendors</Link>
          <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
            <Link
              href="#chrome-extension"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white/80 border border-white/10 rounded-lg"
            >
              <Chrome className="w-4 h-4" />
              Install Extension
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg"
            >
              Sign Up Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Main page ─── */
export default function EnrichLandingPage() {
  return (
    <div className="min-h-screen text-white bg-[#0a0a0a]">
      <EnrichSiteNav />

      <div className="relative z-10 bg-[#0a0a0a] pt-16">
        <main>
          {/* ━━━ Hero ━━━ */}
          <section className="pt-16 sm:pt-24 md:pt-32 pb-16 sm:pb-24 relative overflow-hidden">
            {/* Subtle radial glow */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at center, rgba(16,185,129,0.06) 0%, transparent 70%)",
              }}
            />

            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
              <DarkScrollReveal>
                {/* Free badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">Free with OmniDial</span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight mb-6 heading-display">
                  Stop paying for
                  <br />
                  <span className="text-emerald-400">bad contact data</span>
                </h1>

                <p className="text-white/50 text-base sm:text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed mb-10">
                  Cascade every lead through 6 enrichment vendors until a phone number and email are found.
                  Chrome extension for LinkedIn. Bulk CSV upload. Push to your CRM.
                  All free.
                </p>

                {/* Dual CTA */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <Link
                    href="#chrome-extension"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-sm font-medium text-white border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-xl transition-all"
                  >
                    <Chrome className="w-4 h-4" />
                    Install Chrome Extension
                  </Link>
                  <Link
                    href="/signup"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-[0_0_24px_rgba(16,185,129,0.2)]"
                  >
                    Sign Up Free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </DarkScrollReveal>
            </div>
          </section>

          {/* ━━━ Waterfall section ━━━ */}
          <section id="waterfall" className="py-16 sm:py-24 border-t border-white/5">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <DarkScrollReveal>
                <div className="text-center mb-12 sm:mb-16">
                  <p className="text-xs font-medium text-emerald-400 uppercase tracking-widest mb-4">How it works</p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight heading-display mb-4">
                    The enrichment waterfall
                  </h2>
                  <p className="text-white/40 text-base sm:text-lg max-w-xl mx-auto font-light">
                    Every lead cascades through multiple vendors. If one misses, the next picks it up. Better coverage than any single provider.
                  </p>
                </div>
              </DarkScrollReveal>

              <DarkScrollReveal delay={200}>
                <WaterfallDiagram />
              </DarkScrollReveal>

              {/* Stats row */}
              <DarkScrollReveal delay={400}>
                <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto mt-12 sm:mt-16">
                  {[
                    { value: "6", label: "Vendors" },
                    { value: "93%", label: "Coverage" },
                    { value: "$0", label: "Cost" },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="text-2xl sm:text-3xl font-medium text-white tracking-tight">{stat.value}</div>
                      <div className="text-xs sm:text-sm text-white/30 mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </DarkScrollReveal>
            </div>
          </section>

          {/* ━━━ Features grid ━━━ */}
          <section id="features" className="py-16 sm:py-24 border-t border-white/5">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <DarkScrollReveal>
                <div className="text-center mb-12 sm:mb-16">
                  <p className="text-xs font-medium text-emerald-400 uppercase tracking-widest mb-4">Features</p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight heading-display">
                    Everything you need to enrich
                  </h2>
                </div>
              </DarkScrollReveal>

              <div className="grid sm:grid-cols-2 gap-5">
                {features.map((feature, i) => (
                  <DarkScrollReveal key={feature.title} delay={i * 100}>
                    <div className="group p-6 sm:p-8 bg-[#111111] rounded-2xl border border-white/5 hover:border-white/10 transition-all h-full">
                      <div className="flex items-start justify-between mb-5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
                          <feature.icon className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded-full bg-white/5 text-white/40">
                          {feature.badge}
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">{feature.headline}</h3>
                      <p className="text-white/40 text-sm leading-relaxed font-light">{feature.description}</p>
                    </div>
                  </DarkScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* ━━━ Vendors ━━━ */}
          <section id="vendors" className="py-16 sm:py-24 border-t border-white/5">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <DarkScrollReveal>
                <div className="text-center mb-12 sm:mb-16">
                  <p className="text-xs font-medium text-emerald-400 uppercase tracking-widest mb-4">Data sources</p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight heading-display mb-4">
                    6 vendors in one waterfall
                  </h2>
                  <p className="text-white/40 text-base sm:text-lg max-w-xl mx-auto font-light">
                    Bring your own API keys or use ours. Each vendor is tried in sequence until data is found.
                  </p>
                </div>
              </DarkScrollReveal>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.map((vendor, i) => (
                  <DarkScrollReveal key={vendor.key} delay={i * 80}>
                    <div className="p-5 bg-[#111111] rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${vendor.color}15` }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: vendor.color }}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-white">{vendor.name}</h3>
                        <p className="text-xs text-white/35 font-light">{vendor.description}</p>
                      </div>
                    </div>
                  </DarkScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* ━━━ CRM Push ━━━ */}
          <section className="py-16 sm:py-24 border-t border-white/5">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <DarkScrollReveal>
                  <div>
                    <p className="text-xs font-medium text-emerald-400 uppercase tracking-widest mb-4">CRM integrations</p>
                    <h2 className="text-3xl sm:text-4xl tracking-tight heading-display mb-4">
                      Push enriched leads
                      <br />
                      <span className="text-white/50">to any CRM</span>
                    </h2>
                    <p className="text-white/40 text-sm sm:text-base leading-relaxed font-light mb-6">
                      After enrichment, push contacts to your CRM with one click.
                      Supports individual and bulk push. Map fields automatically.
                    </p>
                    <ul className="space-y-3">
                      {[
                        "One-click push from Chrome extension",
                        "Bulk push after CSV enrichment",
                        "Auto field mapping",
                        "Duplicate detection",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-3 text-sm text-white/60">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </DarkScrollReveal>

                <DarkScrollReveal delay={200}>
                  <div className="flex flex-col gap-4">
                    {crms.map((crm) => (
                      <div
                        key={crm.name}
                        className="p-5 bg-[#111111] rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold text-lg"
                            style={{ backgroundColor: `${crm.color}20` }}
                          >
                            <span style={{ color: crm.color }}>{crm.letter}</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-white">{crm.name}</h3>
                            <p className="text-xs text-white/35 font-light">Connected</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                          <Check className="w-3 h-3" />
                          Supported
                        </div>
                      </div>
                    ))}
                  </div>
                </DarkScrollReveal>
              </div>
            </div>
          </section>

          {/* ━━━ Chrome Extension callout ━━━ */}
          <section id="chrome-extension" className="py-16 sm:py-24 border-t border-white/5">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <DarkScrollReveal>
                <div className="relative p-8 sm:p-12 bg-[#111111] rounded-3xl border border-white/5 overflow-hidden">
                  {/* Subtle emerald glow */}
                  <div
                    className="absolute -top-20 -right-20 w-60 h-60 pointer-events-none"
                    style={{
                      background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
                    }}
                  />

                  <div className="relative flex flex-col md:flex-row items-start md:items-center gap-8">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Chrome className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl sm:text-2xl font-medium text-white mb-2 tracking-tight">
                        Enrich from any LinkedIn profile
                      </h3>
                      <p className="text-white/40 text-sm sm:text-base font-light leading-relaxed mb-6 max-w-lg">
                        Install the Chrome extension, visit a LinkedIn profile, and click Enrich.
                        Phone numbers and emails appear instantly. Push to your CRM without leaving the page.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          href="#chrome-extension"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors"
                        >
                          <Chrome className="w-4 h-4" />
                          Add to Chrome
                          <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                        </Link>
                        <div className="flex items-center gap-2 px-4 py-3 text-xs text-white/30">
                          <Shield className="w-3.5 h-3.5" />
                          No data leaves your browser
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DarkScrollReveal>
            </div>
          </section>

          {/* ━━━ How it works (steps) ━━━ */}
          <section className="py-16 sm:py-24 border-t border-white/5">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
              <DarkScrollReveal>
                <div className="text-center mb-12 sm:mb-16">
                  <p className="text-xs font-medium text-emerald-400 uppercase tracking-widest mb-4">Getting started</p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight heading-display">
                    Enrich in 3 steps
                  </h2>
                </div>
              </DarkScrollReveal>

              <div className="space-y-6">
                {[
                  {
                    step: "01",
                    title: "Upload or browse",
                    description: "Upload a CSV with leads, or visit any LinkedIn profile with our Chrome extension.",
                  },
                  {
                    step: "02",
                    title: "Waterfall enrichment",
                    description: "Each lead cascades through 6 vendors. Phone numbers and emails are matched from multiple sources for maximum coverage.",
                  },
                  {
                    step: "03",
                    title: "Push to CRM",
                    description: "Send enriched contacts to HubSpot, Salesforce, or Attio. Bulk or one by one. Auto-mapped fields.",
                  },
                ].map((item, i) => (
                  <DarkScrollReveal key={item.step} delay={i * 150}>
                    <div className="flex gap-6 items-start p-6 rounded-2xl hover:bg-[#111111]/50 transition-colors">
                      <div className="text-3xl sm:text-4xl font-light text-white/10 tracking-tighter shrink-0 w-12 text-right tabular-nums">
                        {item.step}
                      </div>
                      <div className="border-l border-white/10 pl-6">
                        <h3 className="text-base sm:text-lg font-medium text-white mb-1">{item.title}</h3>
                        <p className="text-white/40 text-sm font-light leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </DarkScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* ━━━ Final CTA ━━━ */}
          <section className="py-20 sm:py-32 border-t border-white/5 relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at 50% 100%, rgba(16,185,129,0.05) 0%, transparent 60%)",
              }}
            />

            <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
              <DarkScrollReveal>
                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight heading-display mb-4">
                  Better data.
                  <br />
                  <span className="text-white/50">Zero cost.</span>
                </h2>
                <p className="text-white/40 text-base sm:text-lg max-w-xl mx-auto font-light mb-10">
                  Stop settling for one vendor&apos;s incomplete data. Waterfall enrichment gives you the coverage of six providers, for free.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <Link
                    href="#chrome-extension"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-sm font-medium text-white border border-white/15 hover:border-white/30 hover:bg-white/5 rounded-xl transition-all"
                  >
                    <Chrome className="w-4 h-4" />
                    Install Chrome Extension
                  </Link>
                  <Link
                    href="/signup"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-[0_0_24px_rgba(16,185,129,0.2)]"
                  >
                    Sign Up Free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </DarkScrollReveal>
            </div>
          </section>
        </main>
      </div>

      <DarkFooter />
    </div>
  );
}
