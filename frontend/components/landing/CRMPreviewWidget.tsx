"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, Filter, Building2, Mail, PhoneCall, Phone, Calendar, ChevronRight, GripVertical, User } from "lucide-react";

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

// Kanban pipeline with animated card movement
function PipelinePreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const initialLeads = useMemo(() => [
    { id: 1, name: "Jensen Huang", company: "NVIDIA", value: "$850k", stage: 0 },
    { id: 2, name: "Satya Nadella", company: "Microsoft", value: "$620k", stage: 0 },
    { id: 3, name: "Lisa Su", company: "AMD", value: "$425k", stage: 1 },
    { id: 4, name: "Andy Jassy", company: "Amazon", value: "$780k", stage: 1 },
    { id: 5, name: "Tim Cook", company: "Apple", value: "$950k", stage: 2 },
    { id: 6, name: "Sundar Pichai", company: "Google", value: "$540k", stage: 3 },
  ], []);

  const stages = [
    { name: "New", color: "bg-blue-500", count: 0 },
    { name: "Contacted", color: "bg-yellow-500", count: 0 },
    { name: "Qualified", color: "bg-green-500", count: 0 },
    { name: "Won", color: "bg-white", count: 0 },
  ];

  const [leads, setLeads] = useState(initialLeads);
  const [movingLead, setMovingLead] = useState<number | null>(null);

  const moveRandomLead = useCallback(() => {
    setLeads(prev => {
      // Find leads that can be moved (not in final stage)
      const movableLeads = prev.filter(l => l.stage < 3);
      if (movableLeads.length === 0) {
        // Reset all leads
        return initialLeads;
      }

      // Pick a random lead to move
      const leadToMove = movableLeads[Math.floor(Math.random() * movableLeads.length)];
      setMovingLead(leadToMove.id);

      setTimeout(() => setMovingLead(null), 600);

      return prev.map(l =>
        l.id === leadToMove.id ? { ...l, stage: l.stage + 1 } : l
      );
    });
  }, [initialLeads]);

  useEffect(() => {
    // Disable animation on mobile or when not visible
    if (isMobile || !isVisible) return;

    const interval = setInterval(moveRandomLead, 3000);
    return () => clearInterval(interval);
  }, [moveRandomLead, isMobile, isVisible]);

  // Calculate stage counts
  const stageCounts = stages.map((_, i) => leads.filter(l => l.stage === i).length);

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Pipeline</span>
        <span className="text-xs text-white/30">$4.17M total</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stages.map((stage, i) => (
          <div key={stage.name} className="space-y-2">
            {/* Stage header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-[10px] text-white/60">{stage.name}</span>
              </div>
              <span className="text-[10px] text-white/30">{stageCounts[i]}</span>
            </div>

            {/* Stage cards */}
            <div className="space-y-1.5 min-h-[120px] bg-white/[0.02] rounded-lg p-1.5">
              {leads
                .filter(l => l.stage === i)
                .map(lead => (
                  <div
                    key={lead.id}
                    className={`p-2 rounded-md bg-[#1a1a1a] border border-white/5 transition-all duration-500 ${
                      movingLead === lead.id
                        ? "scale-105 border-green-500/30 shadow-lg shadow-green-500/10"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <GripVertical className="w-3 h-3 text-white/20" />
                      <span className="text-[10px] text-white font-medium truncate">{lead.name}</span>
                    </div>
                    <div className="flex items-center justify-between pl-4">
                      <span className="text-[9px] text-white/30 truncate">{lead.company}</span>
                      <span className="text-[9px] text-green-400 font-medium">{lead.value}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Lead database list with search animation
function LeadListPreview({ isMobile, isVisible }: { isMobile: boolean; isVisible: boolean }) {
  const allLeads = [
    { name: "Jensen Huang", company: "NVIDIA", email: "jensen@nvidia.com", phone: "+1 408-486-2000", lastContact: "2h ago" },
    { name: "Satya Nadella", company: "Microsoft", email: "satya@microsoft.com", phone: "+1 425-882-8080", lastContact: "1d ago" },
    { name: "Lisa Su", company: "AMD", email: "lisa.su@amd.com", phone: "+1 408-749-4000", lastContact: "3h ago" },
    { name: "Andy Jassy", company: "Amazon", email: "ajassy@amazon.com", phone: "+1 206-266-1000", lastContact: "5d ago" },
    { name: "Tim Cook", company: "Apple", email: "tcook@apple.com", phone: "+1 408-996-1010", lastContact: "Just now" },
  ];

  const [animatedSearchQuery, setAnimatedSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [animatedSelectedLead, setAnimatedSelectedLead] = useState<number | null>(null);

  useEffect(() => {
    // On mobile or when not visible, skip animation
    if (isMobile || !isVisible) {
      return;
    }

    // Simulate search animation
    const cycle = async () => {
      setAnimatedSearchQuery("");
      setIsSearching(false);
      setAnimatedSelectedLead(null);
      await new Promise(r => setTimeout(r, 2000));

      // Type search query
      const query = "AMD";
      setIsSearching(true);
      for (let i = 0; i <= query.length; i++) {
        setAnimatedSearchQuery(query.slice(0, i));
        await new Promise(r => setTimeout(r, 150));
      }
      await new Promise(r => setTimeout(r, 800));

      // Select result
      setAnimatedSelectedLead(2);
      await new Promise(r => setTimeout(r, 3000));
    };

    cycle();
    const interval = setInterval(cycle, 8000);
    return () => clearInterval(interval);
  }, [isMobile, isVisible]);

  // On mobile or when not visible, use static state
  const searchQuery = (isMobile || !isVisible) ? "" : animatedSearchQuery;
  const selectedLead = (isMobile || !isVisible) ? 0 : animatedSelectedLead;

  const filteredLeads = searchQuery
    ? allLeads.filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.company.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allLeads;

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Lead Database</span>
        <span className="text-xs text-white/30">1,247 leads</span>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <div className="w-full pl-9 pr-3 py-2 bg-white/5 rounded-lg text-xs text-white border border-white/10">
          {searchQuery || <span className="text-white/30">Search leads...</span>}
          {isSearching && <span className={`inline-block w-0.5 h-3 bg-green-400 ml-0.5 ${!isMobile ? 'animate-pulse' : ''}`} />}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] text-white/50">
          <Filter className="w-3 h-3" />
          All
        </button>
        <button className="px-2 py-1 bg-white/5 rounded text-[10px] text-white/50">Hot</button>
        <button className="px-2 py-1 bg-white/5 rounded text-[10px] text-white/50">New</button>
      </div>

      {/* Lead list */}
      <div className="space-y-1.5">
        {filteredLeads.slice(0, 4).map((lead, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg transition-all duration-300 cursor-pointer ${
              selectedLead === i
                ? "bg-green-500/10 border border-green-500/20"
                : "bg-white/5 border border-transparent hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium ${
                selectedLead === i ? "bg-green-500 text-black" : "bg-white/10 text-white"
              }`}>
                {lead.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white font-medium truncate">{lead.name}</div>
                <div className="text-[10px] text-white/40 truncate">{lead.company}</div>
              </div>
              <ChevronRight className="w-3 h-3 text-white/20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Lead detail card
function LeadDetailPreview({ isMobile, isVisible: sectionVisible }: { isMobile: boolean; isVisible: boolean }) {
  const [animatedShowDetail, setAnimatedShowDetail] = useState(true);

  useEffect(() => {
    // On mobile or when not visible, skip animation
    if (isMobile || !sectionVisible) {
      return;
    }

    const cycle = async () => {
      setAnimatedShowDetail(false);
      await new Promise(r => setTimeout(r, 5500));
      setAnimatedShowDetail(true);
      await new Promise(r => setTimeout(r, 2500));
    };

    cycle();
    const interval = setInterval(cycle, 8000);
    return () => clearInterval(interval);
  }, [isMobile, sectionVisible]);

  // On mobile or when not visible, always show detail (static state)
  const showDetail = (isMobile || !sectionVisible) ? true : animatedShowDetail;

  if (!showDetail) {
    return (
      <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 flex items-center justify-center min-h-[280px]">
        <div className="text-center">
          <User className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-xs text-white/30">Select a lead to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-lg font-medium text-black">
          LS
        </div>
        <div>
          <div className="font-medium text-white">Lisa Su</div>
          <div className="text-xs text-white/40">CEO</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Building2 className="w-3.5 h-3.5 text-white/30" />
          <span className="text-white/60">AMD</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Mail className="w-3.5 h-3.5 text-white/30" />
          <span className="text-white/60">lisa.su@amd.com</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <PhoneCall className="w-3.5 h-3.5 text-white/30" />
          <span className="text-white/60">+1 408-749-4000</span>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <div className="text-[10px] text-white/40 mb-2">Activity</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[10px] text-white/60">Call connected - 3h ago</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[10px] text-white/60">Email sent - 1d ago</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span className="text-[10px] text-white/60">Meeting scheduled - 2d ago</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 py-2 bg-green-500 text-black text-xs font-medium rounded-lg flex items-center justify-center gap-1.5">
          <Phone className="w-3.5 h-3.5" />
          Call
        </button>
        <button className="flex-1 py-2 bg-white/10 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Schedule
        </button>
      </div>
    </div>
  );
}

export default function CRMPreviewWidget() {
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobileOrTablet();
  const isVisible = useIsVisible(sectionRef);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-[#0a0a0a] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-4 tracking-tight text-white">
            CRM built for dialers
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto font-light">
            Track your pipeline, manage leads, and see every interaction in one place. No more tab switching.
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
                  app.omnidial.io/crm
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
                  <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition-colors">
                    Campaigns
                  </button>
                  <button className="px-3 py-1.5 text-xs bg-white/10 text-white rounded-md">
                    CRM
                  </button>
                </div>
              </div>

              {/* App layout - stacked on mobile */}
              <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-4 md:gap-4">
                <div className="md:col-span-2 order-2 md:order-1">
                  <PipelinePreview isMobile={isMobile} isVisible={isVisible} />
                </div>
                <div className="order-1 md:order-2">
                  <LeadListPreview isMobile={isMobile} isVisible={isVisible} />
                </div>
                <div className="order-3">
                  <LeadDetailPreview isMobile={isMobile} isVisible={isVisible} />
                </div>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
