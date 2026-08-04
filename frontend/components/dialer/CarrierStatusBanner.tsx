"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { env } from "@/lib/config";

interface TelnyxHealth {
  healthy: boolean;
  latencyMs: number;
  httpStatus?: number;
  error?: string;
  checkedAt: string;
}

const POLL_INTERVAL_MS = 60_000;

// One failed probe is usually a blip. Two consecutive failures is an outage.
// Without this the banner flickers on every transient 500.
const FAILURES_BEFORE_ALERT = 2;

/**
 * Shows a carrier-degraded banner when the Telnyx credential API — the one the
 * browser dialer needs for telephony tokens — stops responding. Without this a
 * carrier outage is indistinguishable from a broken build: calls simply fail to
 * connect with no explanation anywhere in the UI.
 */
export function CarrierStatusBanner() {
  const [degraded, setDegraded] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;

    const check = async () => {
      try {
        const res = await fetch(`${env.API_URL.toString()}/health/telnyx`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const health: TelnyxHealth = await res.json();
        if (cancelled) return;

        if (health.healthy) {
          failures = 0;
          setDegraded(false);
          setDetail(null);
        } else {
          failures += 1;
          if (failures >= FAILURES_BEFORE_ALERT) {
            setDegraded(true);
            setDetail(health.error ?? `HTTP ${health.httpStatus ?? "error"}`);
          }
        }
      } catch {
        // A failure to reach our own API is a different problem — the app has
        // its own error handling for that, so don't claim the carrier is down.
        if (!cancelled) failures = 0;
      }
    };

    check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!degraded) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          Calling temporarily unavailable
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Our carrier is not responding, so new calls may fail to connect. This
          is not a problem with your setup.{" "}
          <a
            href="https://status.telnyx.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Check carrier status
          </a>
          .
        </p>
        {detail && (
          <p className="mt-1 truncate text-xs text-muted-foreground/70">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

export default CarrierStatusBanner;
