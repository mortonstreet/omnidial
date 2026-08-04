"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Phone,
  PhoneIncoming,
  History,
  Settings,
  AlertCircle,
  Plus,
  Loader2,
  Trash2,
  Play,
  Zap,
  Headphones,
  PhoneMissed,
  Voicemail,
} from "lucide-react";
import {
  DialerPanel,
  CallHistory,
  IncomingCallModal,
  ClientCampaignListSelector,
  PowerDialerControls,
  ScriptPanel,
  DispositionEditor,
  PhoneNumberAssignmentManager,
  InboundCallsPanel,
  LiveMonitorPanel,
  ParallelDialerControls,
  DialerLoader,
  VoicemailInboxPanel,
  VoicemailGreetingManager,
} from "@/components/dialer";
import { CoachCardOverlay } from "@/components/live-coach/CoachCardOverlay";
import { useMyAssignedClients } from "@/hooks/api/useClientUserAssignments";
import { useDialerConfig } from "@/hooks/api/useDialer";
import { useVoicemailDrops, useDeleteVoicemailDrop } from "@/hooks/api/useCalls";
import { useVoicemailInbox } from "@/hooks/api/useVoicemailInbox";
import { useActiveOrganization, useSession } from "@/lib/auth-client";
import { useListOrganizationMembers } from "@/hooks/api/useOrganization";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { ExperimentalBadge } from "@/components/ui/ExperimentalBadge";
import { useDialerContext } from "@/components/providers/DialerProvider";
import { Button } from "@/components/ui/button";
import { ClientUserAssignmentManager } from "@/components/settings/ClientUserAssignmentManager";
import { toast } from "sonner";
import type { Lead } from "@/hooks/api/usePowerDialer";

type TabType = "dialer" | "power-dialer" | "parallel-dialer" | "inbound" | "voicemail" | "history" | "live-monitor" | "settings";

interface Member {
  id: string;
  userId: string;
  role: string;
}

interface Selection {
  clientId?: string;
  campaignId?: string;
  listId?: string;
}

function DialerPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("dialer");
  const { data: session } = useSession();
  const isSuperAdminUser = useSuperAdmin();
  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;

  // Get phone and leadId from URL params (for click-to-call from other pages)
  const urlPhone = searchParams.get("phone") || undefined;
  const urlLeadId = searchParams.get("leadId") || undefined;
  const urlTab = searchParams.get("tab") as TabType | null;

  // Set active tab from URL parameter
  useEffect(() => {
    if (urlTab && ["dialer", "power-dialer", "parallel-dialer", "inbound", "voicemail", "history", "live-monitor", "settings"].includes(urlTab)) {
      queueMicrotask(() => setActiveTab(urlTab));
    }
  }, [urlTab]);

  // Show toast when phone number is loaded from URL (e.g. from Chrome extension)
  useEffect(() => {
    if (urlPhone) {
      toast.info(`Phone number loaded: ${urlPhone}`, { duration: 3000 });
    }
  }, [urlPhone]);

  // Track whether the initial device setup has completed (loader dismissed)
  const [hasCompletedFirstLoad, setHasCompletedFirstLoad] = useState(false);

  // Manual dialer state
  const [manualDialerClientId, setManualDialerClientId] = useState<string | undefined>(undefined);

  // Dialer context - must be before using its values
  const {
    isReady,
    error,
    isInitializing,
    incomingCall,
    connection,
    callState,
    currentCallId,
    answerIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    initializeDevice,
    // Persisted selection and parallel session state
    dialerSelection,
    setDialerSelection,
    parallelSession,
    setParallelSession,
    // For floating widget
    setCurrentLeadInfo,
  } = useDialerContext();

  // If device is already ready on mount (e.g. navigating back), skip loader
  useEffect(() => {
    if (isReady && !hasCompletedFirstLoad) {
      queueMicrotask(() => setHasCompletedFirstLoad(true));
    }
  }, [isReady, hasCompletedFirstLoad]);

  // Power dialer state - use dialerSelection from context for persistence
  const selection = dialerSelection;
  const setSelection = useCallback((newSelection: Selection) => {
    setDialerSelection(newSelection);
  }, [setDialerSelection]);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [powerDialerPhone, setPowerDialerPhone] = useState<string>("");
  // Use a counter instead of boolean to ensure each call end is detected
  const [callEndedCount, setCallEndedCount] = useState(0);
  // Counter to trigger auto-dial (separate from display)
  const [dialTrigger, setDialTrigger] = useState(0);

  // Fetch clients for manual dialer selector (role-aware: admins get all, members get assigned only)
  const { data: clients } = useMyAssignedClients();

  // Get organization members to check user role
  const { data: membersData } = useListOrganizationMembers();
  const members = (membersData?.data?.members || []) as Member[];

  // Check if current user is admin or owner
  const currentUserMember = members.find((m) => m.userId === session?.user?.id);
  const isSuperAdmin = useSuperAdmin();
  const isAdminOrOwner = isSuperAdmin || currentUserMember?.role === 'admin' || currentUserMember?.role === 'owner';

  // Fetch voicemail inbox for unread count badge
  const { data: voicemailInboxData } = useVoicemailInbox({ page: 1, limit: 1 });
  const voicemailUnreadCount = voicemailInboxData?.unreadCount || 0;

  // Handle selection changes from ClientCampaignListSelector
  const handleSelectionChange = useCallback((newSelection: Selection) => {
    setSelection(newSelection);
    // Clear current lead and phone when selection changes
    setCurrentLead(null);
    setPowerDialerPhone("");
  }, [setSelection, setCurrentLead]);

  // Handle lead selection from PowerDialerControls
  const handleLeadSelect = useCallback((lead: Lead) => {
    setCurrentLead(lead);
    // Update phone display immediately when lead changes
    setPowerDialerPhone(lead.phone);
  }, []);

  // Handle call initiated from PowerDialerControls (countdown finished, ready to dial)
  const handleCallInitiated = useCallback((lead: Lead) => {
    setPowerDialerPhone(lead.phone);
    // Set extended lead info for the floating widget
    setCurrentLeadInfo({
      id: lead.id,
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
      phone: lead.phone,
      firstName: lead.firstName,
      lastName: lead.lastName,
      linkedInUrl: lead.linkedInUrl,
      website: lead.website,
      timezone: lead.timezone,
      campaignId: selection.campaignId,
      listId: selection.listId || lead.listId || undefined,
    });
    // Trigger the dial by incrementing the counter
    setDialTrigger(prev => prev + 1);
  }, [setCurrentLeadInfo, selection.campaignId, selection.listId]);

  // Handle call end - signal to PowerDialerControls (don't clear phone - next lead's phone will be set)
  const handlePowerDialerCallEnd = useCallback(() => {
    // Increment counter to signal call ended - PowerDialerControls watches this
    // The new lead's phone will be set via handleLeadSelect when advanceToNext completes
    setCallEndedCount(prev => prev + 1);
  }, []);

  // Handle callback from inbound calls panel
  const handleCallBack = useCallback((phoneNumber: string, leadId?: string) => {
    setActiveTab("dialer");
    // Small delay to let tab switch, then the URL params will trigger the dial
    setTimeout(() => {
      window.history.pushState({}, "", `/dashboard/dialer?phone=${encodeURIComponent(phoneNumber)}${leadId ? `&leadId=${leadId}` : ""}`);
      window.location.reload();
    }, 100);
  }, []);

  // Live Coach state for overlay
  const [activeCoachCard, setActiveCoachCard] = useState<{
    id: string;
    triggerId: string;
    title: string;
    category: string;
    content: string;
    tips?: string[];
    triggerPhrase: string;
  } | null>(null);

  // Parallel dialer state - use context for persistence across tab switches
  const parallelSessionActive = parallelSession.isActive;
  const parallelSessionId = parallelSession.sessionId;
  const setParallelSessionState = useCallback((updates: { isActive?: boolean; sessionId?: string; conferenceId?: string }) => {
    setParallelSession((prev) => ({ ...prev, ...updates }));
  }, [setParallelSession]);
  const [parallelConnectedLead, setParallelConnectedLead] = useState<Lead | null>(null);

  // Handle parallel dialer call connected
  const handleParallelLeadConnected = useCallback((attempt: { leadId: string; leadName: string | null; leadCompany: string | null }) => {
    // Create a minimal lead object from the attempt data
    if (attempt.leadId) {
      setParallelConnectedLead({
        id: attempt.leadId,
        firstName: attempt.leadName?.split(' ')[0] || '',
        lastName: attempt.leadName?.split(' ').slice(1).join(' ') || '',
        company: attempt.leadCompany || undefined,
        phone: '', // We don't have phone in the attempt response
      } as Lead);
    }
  }, []);

  // Handle parallel dialer session end
  const handleParallelSessionEnd = useCallback(() => {
    setParallelSessionState({ isActive: false, sessionId: undefined, conferenceId: undefined });
    setParallelConnectedLead(null);
  }, [setParallelSessionState]);

  // Build tabs - settings available to all (content is role-filtered)
  // Parallel Dialer and Live Monitor are experimental (superadmin only)
  const baseTabs = [
    { id: "dialer" as const, label: "Manual Dialer", icon: Phone, experimental: false },
    { id: "power-dialer" as const, label: "Power Dialer", icon: Zap, experimental: false },
    { id: "inbound" as const, label: "Inbound", icon: PhoneIncoming, experimental: false },
    { id: "voicemail" as const, label: "Voicemail", icon: Voicemail, experimental: false, badge: voicemailUnreadCount },
    { id: "history" as const, label: "History", icon: History, experimental: false },
  ];

  const experimentalTabs = isSuperAdmin ? [
    { id: "parallel-dialer" as const, label: "Parallel Dialer", icon: PhoneMissed, experimental: true },
    { id: "live-monitor" as const, label: "Live Monitor", icon: Headphones, experimental: true },
  ] : [];

  const tabs = [
    ...baseTabs,
    ...experimentalTabs,
    { id: "settings" as const, label: "Settings", icon: Settings, experimental: false },
  ];

  // Fetch dialer config to check if dialer is provisioned for this org
  const { data: dialerConfigData, isLoading: isConfigLoading } = useDialerConfig(organizationId);

  // Access gate: allow superadmin always; allow members only if their org has dialer configured
  if (session && !isSuperAdminUser && !isConfigLoading && !dialerConfigData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Dialer Not Configured</h2>
          <p className="text-muted-foreground text-sm">
            The dialer has not been set up for your organization. Contact your administrator to configure Twilio credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">Dialer</h1>
        </div>
      </div>

      {/* Full branded loader on first init */}
      {!hasCompletedFirstLoad && (isInitializing || (!isReady && error)) && (
        <DialerLoader onReady={() => setHasCompletedFirstLoad(true)} />
      )}

      {/* Error banner - only show AFTER first load completes (not during init loader) */}
      {hasCompletedFirstLoad && !isInitializing && error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            {currentUserMember?.role === 'admin' ? (
              <>
                <p className="text-sm font-medium text-destructive">Connection Error</p>
                <p className="text-xs text-destructive/80 mt-1">{error}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-destructive">Unable to Connect</p>
                <p className="text-xs text-destructive/80 mt-1">
                  The dialer is having trouble connecting. Please wait a moment and try again.
                  If this issue persists, contact your administrator.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Tab Selector */}
      <div className={`sm:hidden mb-6 ${!hasCompletedFirstLoad ? "hidden" : ""}`}>
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as TabType)}
          className="w-full h-12 px-4 bg-muted border border-border rounded-xl text-foreground appearance-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>{tab.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop Tabs */}
      <div role="tablist" aria-label="Dialer sections" className={`sm:flex gap-1 p-1 bg-muted/30 rounded-xl w-fit mb-8 ${!hasCompletedFirstLoad ? "hidden" : "hidden sm:flex"}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.experimental && <ExperimentalBadge />}
            {'badge' in tab && typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full min-w-[18px] text-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`flex-1 min-h-0 ${!hasCompletedFirstLoad ? "hidden" : ""}`}>
        {activeTab === "dialer" && (
          <div className="h-full flex items-start justify-center pt-4">
            <div className="w-full sm:max-w-md">
              <DialerPanel
                phoneNumber={urlPhone}
                leadId={urlLeadId}
                clientId={manualDialerClientId}
                clients={clients}
                onClientChange={setManualDialerClientId}
              />
            </div>
          </div>
        )}

        {activeTab === "power-dialer" && (
          <PowerDialerTab
            selection={selection}
            currentLead={currentLead}
            powerDialerPhone={powerDialerPhone}
            callEndedCount={callEndedCount}
            callState={callState}
            dialTrigger={dialTrigger}
            onSelectionChange={handleSelectionChange}
            onLeadSelect={handleLeadSelect}
            onCallInitiated={handleCallInitiated}
            onCallEnd={handlePowerDialerCallEnd}
            onEndCall={endCall}
          />
        )}

        {activeTab === "parallel-dialer" && isSuperAdmin && (
          <div className="h-full flex flex-col lg:grid lg:grid-cols-2 gap-6">
            {/* Left Column - Selection & Controls */}
            <div className="space-y-4 order-2 lg:order-1">
              {/* Client/Campaign/List Selector */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Select Campaign
                </h3>
                <ClientCampaignListSelector
                  onSelectionChange={handleSelectionChange}
                  initialClientId={selection.clientId}
                  initialCampaignId={selection.campaignId}
                  initialListId={selection.listId}
                />
              </div>

              {/* Parallel Dialer Controls */}
              {selection.listId && (
                <ParallelDialerControls
                  campaignId={selection.campaignId}
                  listId={selection.listId}
                  clientId={selection.clientId}
                  isSessionActive={parallelSessionActive}
                  currentSessionId={parallelSessionId}
                  onSessionStart={(sessionId, conferenceId) => {
                    setParallelSessionState({ isActive: true, sessionId, conferenceId });
                  }}
                  onSessionEnd={handleParallelSessionEnd}
                  onLeadConnected={handleParallelLeadConnected}
                />
              )}

              {/* Script Panel - show connected lead or selected lead */}
              <ScriptPanel
                campaignId={selection.campaignId}
                lead={parallelConnectedLead || currentLead}
              />
            </div>

            {/* Right Column - Active Call Display / Lead Info */}
            <div className="flex items-start justify-center pt-4 order-1 lg:order-2">
              <div className="w-full sm:max-w-md space-y-4">
                {parallelSessionActive && parallelConnectedLead ? (
                  // Connected - show lead info and call controls
                  <>
                    {/* Connected Lead Info */}
                    <div className="bg-card border border-green-500/30 rounded-xl p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                          <Phone className="w-7 h-7 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {parallelConnectedLead.firstName} {parallelConnectedLead.lastName}
                          </h3>
                          {parallelConnectedLead.company && (
                            <p className="text-sm text-muted-foreground">{parallelConnectedLead.company}</p>
                          )}
                          <div className="flex items-center gap-2 text-green-500 text-sm font-medium mt-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Call Connected
                          </div>
                        </div>
                      </div>

                      {/* Call info */}
                      <div className="text-xs text-muted-foreground border-t border-border pt-3 mt-3">
                        Connected via parallel dialer conference. Use the controls in the panel to manage the call.
                      </div>
                    </div>

                    {/* Dialer Panel for call controls - connects through conference */}
                    <DialerPanel
                      leadId={parallelConnectedLead.id}
                      campaignId={selection.campaignId}
                      clientId={selection.clientId}
                      onCallEnd={() => {
                        setParallelConnectedLead(null);
                      }}
                    />
                  </>
                ) : parallelSessionActive ? (
                  // Session active but no connection yet
                  <div className="bg-card border border-border rounded-xl p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <PhoneMissed className="w-8 h-8 text-green-500 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Parallel Dialing Active</h3>
                    <p className="text-muted-foreground text-sm">
                      Click &quot;Dial Next Batch&quot; to start dialing. First answered call will be connected.
                    </p>
                  </div>
                ) : (
                  // Not started
                  <div className="bg-card border border-border rounded-xl p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <PhoneMissed className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Parallel Dialer</h3>
                    <p className="text-muted-foreground text-sm">
                      Select a client and campaign, then start parallel dialing to reach leads faster.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "inbound" && (
          <div className="h-full overflow-auto max-w-4xl">
            <InboundCallsPanel
              incomingCall={incomingCall}
              connection={connection}
              callState={callState}
              currentCallId={currentCallId}
              isReady={isReady}
              answerIncomingCall={answerIncomingCall}
              rejectIncomingCall={rejectIncomingCall}
              endCall={endCall}
              toggleMute={toggleMute}
              initializeDevice={initializeDevice}
              onCallBack={handleCallBack}
            />
          </div>
        )}

        {activeTab === "voicemail" && (
          <div className="h-full overflow-auto max-w-2xl">
            <VoicemailInboxPanel onCallBack={handleCallBack} />
          </div>
        )}

        {activeTab === "history" && (
          <div className="h-full overflow-auto">
            <CallHistory />
          </div>
        )}

        {activeTab === "live-monitor" && isSuperAdmin && (
          <div className="h-full overflow-auto max-w-2xl">
            <LiveMonitorPanel />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-2xl">
            <DialerSettings organizationId={organizationId} isAdminOrOwner={isAdminOrOwner} />
          </div>
        )}
      </div>

      {/* Live Coach Overlay - shows during active calls */}
      {activeCoachCard && (
        <CoachCardOverlay
          card={activeCoachCard}
          onDismiss={() => setActiveCoachCard(null)}
        />
      )}

      {/* Incoming call modal - only show when not on inbound tab since InboundCallsPanel handles it */}
      {incomingCall && activeTab !== "inbound" && (
        <IncomingCallModal
          callerNumber={incomingCall.options.remoteCallerNumber || "Unknown"}
          onAnswer={answerIncomingCall}
          onDecline={rejectIncomingCall}
        />
      )}
    </div>
  );
}

// Power Dialer Tab Component
function PowerDialerTab({
  selection,
  currentLead,
  powerDialerPhone,
  callEndedCount,
  callState,
  dialTrigger,
  onSelectionChange,
  onLeadSelect,
  onCallInitiated,
  onCallEnd,
  onEndCall,
}: {
  selection: Selection;
  currentLead: Lead | null;
  powerDialerPhone: string;
  callEndedCount: number;
  callState: string;
  dialTrigger: number;
  onSelectionChange: (selection: Selection) => void;
  onLeadSelect: (lead: Lead) => void;
  onCallInitiated: (lead: Lead) => void;
  onCallEnd: () => void;
  onEndCall: () => Promise<void>;
}) {
  return (
    <div className="h-full flex flex-col lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr_auto] gap-4">
      {/* Campaign selector - shows first on mobile */}
      <div className="lg:row-start-1 lg:col-start-1 order-1">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Select Campaign
          </h3>
          <ClientCampaignListSelector
            onSelectionChange={onSelectionChange}
            initialClientId={selection.clientId}
            initialCampaignId={selection.campaignId}
            initialListId={selection.listId}
          />
        </div>
      </div>

      {/* Dialer - shows second on mobile */}
      <div className="lg:row-start-1 lg:col-start-2 flex items-start justify-center order-2">
        <div className="w-full sm:max-w-md">
          <DialerPanel
            phoneNumber={powerDialerPhone}
            leadId={currentLead?.id}
            campaignId={selection.campaignId}
            clientId={selection.clientId}
            onCallEnd={onCallEnd}
            dialTrigger={dialTrigger}
          />
        </div>
      </div>

      {/* Power Dialer Controls - shows third on mobile */}
      <div className="lg:row-start-2 lg:col-start-1 order-3">
        <PowerDialerControls
          campaignId={selection.campaignId}
          listId={selection.listId}
          onLeadSelect={onLeadSelect}
          onCallInitiated={onCallInitiated}
          onEndCall={onEndCall}
          callEndedCount={callEndedCount}
          callState={callState}
        />
      </div>

      {/* Script Panel - shows fourth on mobile */}
      <div className="lg:row-start-2 lg:col-start-2 order-4">
        <ScriptPanel
          campaignId={selection.campaignId}
          lead={currentLead}
        />
      </div>

      {/* Keyboard shortcuts bar */}
      <div className="lg:col-span-2 order-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-muted border border-border rounded font-mono text-[11px] text-foreground/70">↑</kbd>
          <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-muted border border-border rounded font-mono text-[11px] text-foreground/70">↓</kbd>
          Navigate leads
        </span>
        <span className="hidden sm:inline text-border/60">|</span>
        <span className="flex items-center gap-1.5">
          <kbd className="inline-flex items-center justify-center h-[22px] px-1.5 bg-muted border border-border rounded font-mono text-[11px] text-foreground/70">Enter</kbd>
          Call / End call
        </span>
        <span className="hidden sm:inline text-border/60">|</span>
        <span className="flex items-center gap-1.5">
          <kbd className="inline-flex items-center justify-center h-[22px] px-1.5 bg-muted border border-border rounded font-mono text-[11px] text-foreground/70">⌘L</kbd>
          Open LinkedIn
        </span>
        <span className="hidden sm:inline text-border/60">|</span>
        <span className="flex items-center gap-1.5">
          <kbd className="inline-flex items-center justify-center h-[22px] px-1.5 bg-muted border border-border rounded font-mono text-[11px] text-foreground/70">⌘J</kbd>
          Open website
        </span>
      </div>
    </div>
  );
}

// Settings card component
function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5">{description}</p>
      {children}
    </div>
  );
}

// Dialer settings component - with role-based sections
function DialerSettings({ organizationId, isAdminOrOwner }: { organizationId?: string; isAdminOrOwner: boolean }) {
  const [playingVoicemail, setPlayingVoicemail] = useState<string | null>(null);

  // Fetch existing config (only for admin/owner)
  const { data: config } = useDialerConfig(organizationId);

  // Fetch voicemail drops
  const { data: voicemailDropsData, isLoading: voicemailsLoading } = useVoicemailDrops();
  const voicemailDrops = voicemailDropsData?.data || [];
  const deleteVoicemail = useDeleteVoicemailDrop();

  const handlePlayVoicemail = (id: string, url: string) => {
    if (playingVoicemail === id) {
      setPlayingVoicemail(null);
    } else {
      setPlayingVoicemail(id);
      const audio = new Audio(url);
      audio.onended = () => setPlayingVoicemail(null);
      audio.play();
    }
  };

  const handleDeleteVoicemail = async (id: string) => {
    try {
      await deleteVoicemail.mutateAsync(id);
      toast.success("Voicemail deleted");
    } catch {
      toast.error("Failed to delete voicemail");
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Phone Number Assignments & User-Client Assignments - Admin/Owner Only */}
      {isAdminOrOwner && (
        <>
          {/* Phone Numbers - Admin/Owner Only (config is auto-created during provisioning) */}
          {config && (
            <SettingsCard
              title="Phone Numbers"
              description="Manage phone numbers from your Twilio account and assign them to clients."
            >
              <PhoneNumberAssignmentManager organizationId={organizationId!} />
            </SettingsCard>
          )}

          {/* User-Client Assignments - Admin/Owner Only */}
          <SettingsCard
            title="User-Client Access"
            description="Control which team members can access specific clients. Members can only see and dial for clients assigned to them."
          >
            <ClientUserAssignmentManager organizationId={organizationId!} />
          </SettingsCard>
        </>
      )}

      {/* Voicemail Drops - Available to all users */}
      <SettingsCard
        title="Voicemail Drops"
        description="Pre-recorded voicemail messages to drop during calls when you reach an answering machine."
      >
        <div className="space-y-3">
          {voicemailsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : voicemailDrops.length > 0 ? (
            voicemailDrops.map((vm: { id: string; name: string; recordingUrl: string; duration: number }) => (
              <div
                key={vm.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border group"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePlayVoicemail(vm.id, vm.recordingUrl)}
                    aria-label={playingVoicemail === vm.id ? "Playing voicemail" : `Play voicemail: ${vm.name}`}
                    className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition"
                  >
                    {playingVoicemail === vm.id ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 text-primary" />
                    )}
                  </button>
                  <div>
                    <p className="text-sm font-medium text-foreground">{vm.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDuration(vm.duration)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteVoicemail(vm.id)}
                  disabled={deleteVoicemail.isPending}
                  aria-label={`Delete voicemail: ${vm.name}`}
                  className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No voicemail drops configured
            </div>
          )}
          <Button variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Record New Voicemail
          </Button>
        </div>
      </SettingsCard>

      {/* Voicemail Greetings - Available to all users */}
      <SettingsCard
        title="Voicemail Greetings"
        description="Custom greetings that play when inbound calls go unanswered. The active greeting replaces the default message."
      >
        <VoicemailGreetingManager />
      </SettingsCard>

      {/* Call Status Options - Available to all users */}
      <SettingsCard
        title="Call Status"
        description="Customize the status options shown after calls to track outcomes."
      >
        <DispositionEditor />
      </SettingsCard>

      {/* Call Recording - Admin/Owner Only */}
      {isAdminOrOwner && (
        <SettingsCard
          title="Call Recording"
          description="Configure automatic call recording settings for your organization."
        >
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-record all calls</p>
              <p className="text-xs text-muted-foreground">Automatically record all outbound and inbound calls</p>
            </div>
            <button
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors"
              role="switch"
              aria-checked="true"
              aria-label="Auto-record all calls"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 transition-transform" />
            </button>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="py-24 text-center text-muted-foreground">Loading...</div>
  );
}

export default function DialerPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DialerPageContent />
    </Suspense>
  );
}
