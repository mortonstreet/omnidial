"use client";

import { useState } from "react";
import { Voicemail, ChevronDown } from "lucide-react";
import { useVoicemailDrops, useDropVoicemail } from "@/hooks/api/useCalls";
import { useActiveOrganization } from "@/lib/auth-client";

interface VoicemailDropButtonProps {
  callId: string | null;
  disabled?: boolean;
}

export function VoicemailDropButton({ callId, disabled }: VoicemailDropButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;
  const { data: voicemailDrops } = useVoicemailDrops(!!organizationId);
  const { mutate: dropVoicemail, isPending } = useDropVoicemail();

  const handleDrop = (voicemailDropId: string) => {
    if (!callId) return;

    dropVoicemail(
      { callId, voicemailDropId },
      {
        onSuccess: () => {
          setIsOpen(false);
        },
      }
    );
  };

  if (!voicemailDrops?.data?.length) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isPending || !callId}
        className="flex items-center gap-2 p-4 bg-muted hover:bg-muted/80 text-foreground rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Voicemail className="w-6 h-6" />
        <ChevronDown className={`w-4 h-4 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
              Drop Voicemail
            </div>
            {voicemailDrops.data.map((vm) => (
              <button
                key={vm.id}
                onClick={() => handleDrop(vm.id)}
                disabled={isPending}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition disabled:opacity-50"
              >
                <div className="font-medium">{vm.name}</div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(vm.duration)}s
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
