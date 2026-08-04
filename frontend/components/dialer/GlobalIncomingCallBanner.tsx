"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Phone, PhoneOff, PhoneIncoming, User, Building, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useDialerContext } from "@/components/providers/DialerProvider";
import { useLookupLead } from "@/hooks/api/useLeads";

interface LeadInfo {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  linkedInUrl?: string | null;
  email?: string | null;
}

export function GlobalIncomingCallBanner() {
  const {
    incomingCall,
    answerIncomingCall,
    rejectIncomingCall,
  } = useDialerContext();

  const router = useRouter();
  const pathname = usePathname();
  const [isAnimating, setIsAnimating] = useState(false);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);

  const lookupLead = useLookupLead();

  // Don't show on dialer page (it has its own handling)
  const isOnDialerPage = pathname === "/dashboard/dialer";

  // Animation pulse effect
  useEffect(() => {
    if (incomingCall) {
      const interval = setInterval(() => {
        setIsAnimating((prev) => !prev);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [incomingCall]);

  // Look up lead when incoming call arrives
  useEffect(() => {
    if (incomingCall) {
      const callerNumber = incomingCall.options?.remoteCallerNumber;
      if (callerNumber) {
        lookupLead.mutate(callerNumber, {
          onSuccess: (data) => {
            if (data) {
              setLeadInfo(data as LeadInfo);
            }
          },
          onError: () => {
            // Lead not found - that's okay
            setLeadInfo(null);
          },
        });
      }
    } else {
      setLeadInfo(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCall]);

  // Don't render if no incoming call or on dialer page
  if (!incomingCall || isOnDialerPage) {
    return null;
  }

  const callerNumber = incomingCall.options?.remoteCallerNumber || "Unknown";
  const leadName = leadInfo
    ? [leadInfo.firstName, leadInfo.lastName].filter(Boolean).join(" ") || null
    : null;

  // Extract domain from email for website link
  const websiteDomain = leadInfo?.email
    ? leadInfo.email.split("@")[1]
    : null;

  const handleAnswer = () => {
    answerIncomingCall();
    // Navigate to dialer page inbound tab
    router.push("/dashboard/dialer?tab=inbound");
  };

  const handleDecline = () => {
    rejectIncomingCall();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-300">
      <div
        className={`bg-gradient-to-r from-green-600 to-green-500 text-white px-4 py-3 shadow-lg transition-all duration-300 ${
          isAnimating ? "brightness-110" : "brightness-100"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left - Caller Info */}
          <div className="flex items-center gap-4">
            <div className={`p-2 bg-white/20 rounded-full ${isAnimating ? "scale-110" : "scale-100"} transition-transform`}>
              <PhoneIncoming className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">Incoming Call</span>
                <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">LIVE</span>
              </div>
              {leadName ? (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-white">
                    <User className="w-4 h-4" />
                    <span className="font-semibold">{leadName}</span>
                    {leadInfo?.id && (
                      <Link
                        href={`/dashboard/leads/${leadInfo.id}`}
                        className="text-white/70 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                  {leadInfo?.company && (
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <Building className="w-3.5 h-3.5" />
                      <span>{leadInfo.company}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-white/70 text-sm">
                    <span className="font-mono">{callerNumber}</span>
                    {leadInfo?.linkedInUrl && (
                      <a
                        href={leadInfo.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-white/70 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                        </svg>
                        LinkedIn
                      </a>
                    )}
                    {websiteDomain && (
                      <a
                        href={`https://${websiteDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-white/70 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {websiteDomain}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-white/90">
                  <User className="w-4 h-4" />
                  <span className="font-mono">{callerNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-3">
            {/* Decline Button */}
            <button
              onClick={handleDecline}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-colors shadow-md"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="hidden sm:inline">Decline</span>
            </button>

            {/* Answer Button */}
            <button
              onClick={handleAnswer}
              className="flex items-center gap-2 px-6 py-2 bg-white text-green-600 hover:bg-green-50 rounded-lg font-semibold transition-colors shadow-md"
            >
              <Phone className="w-5 h-5" />
              <span>Answer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
