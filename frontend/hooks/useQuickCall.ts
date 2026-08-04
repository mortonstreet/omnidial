"use client";

import { useState, useCallback } from "react";
import { useDialerContext } from "@/components/providers/DialerProvider";
import { useActiveOrganization } from "@/lib/auth-client";
import { useTwilioPhoneNumbers } from "@/hooks/api/useDialer";
import { get } from "@/lib/api";
import { ENDPOINTS } from "@/lib/config";
import { toast } from "sonner";
import type { DialablePhoneNumber } from "@shared/types/src";

interface QuickCallParams {
  leadId: string;
  leadName: string;
  phone: string;
  clientId?: string | null;
}

export function useQuickCall() {
  const [isDialing, setIsDialing] = useState(false);

  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;

  const {
    callState,
    device,
    isReady,
    initializeDevice,
    makeCall,
    setCurrentLeadInfo,
  } = useDialerContext();

  // Pre-fetch org phone numbers as fallback
  const { data: orgPhoneNumbers } = useTwilioPhoneNumbers(organizationId);

  const quickCall = useCallback(
    async ({ leadId, leadName, phone, clientId }: QuickCallParams) => {
      if (callState !== "idle" || isDialing) {
        toast.error("Already in a call", {
          description: "Please end the current call before starting a new one",
        });
        return;
      }

      setIsDialing(true);

      try {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        toast.error("Microphone access required", {
          description: "Please allow microphone access to make calls",
        });
        setIsDialing(false);
        return;
      }

      // Initialize device if not ready
      if (!device || !isReady) {
        const success = await initializeDevice();
        if (!success) {
          toast.error("Failed to connect to dialer", {
            description: "Please check your Twilio configuration and try again",
          });
          setIsDialing(false);
          return;
        }
      }

      try {
        // Resolve caller ID
        let fromNumber: string | undefined;

        if (clientId && organizationId) {
          // Try client-specific numbers first
          try {
            const response = await get<{ data: DialablePhoneNumber[] }>(
              ENDPOINTS.DIALER.DIALABLE_PHONE_NUMBERS(organizationId, clientId)
            );
            const clientNumbers = response?.data ?? [];
            if (clientNumbers.length > 0) {
              fromNumber = clientNumbers[0].phoneNumber;
            }
          } catch {
            // Fall through to org numbers
          }
        }

        // Fallback to org-level numbers
        if (!fromNumber && orgPhoneNumbers && orgPhoneNumbers.length > 0) {
          fromNumber = orgPhoneNumbers[0].phoneNumber;
        }

        if (!fromNumber) {
          toast.error("No phone numbers available", {
            description: "Please configure phone numbers in your dialer settings",
          });
          setIsDialing(false);
          return;
        }

        // Set lead info for the floating widget
        setCurrentLeadInfo({
          id: leadId,
          name: leadName,
          phone,
        });

        await makeCall(phone, leadId, undefined, fromNumber);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error("Failed to place call", { description: message });
      } finally {
        setIsDialing(false);
      }
    },
    [callState, isDialing, device, isReady, initializeDevice, makeCall, setCurrentLeadInfo, organizationId, orgPhoneNumbers]
  );

  return { quickCall, isDialing };
}
