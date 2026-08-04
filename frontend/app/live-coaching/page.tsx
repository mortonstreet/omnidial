import type { Metadata } from "next";
import MarketingShell, {
  MarketingSection,
} from "@/components/landing/MarketingShell";

export const metadata: Metadata = {
  title: "Live Coaching | OmniDial",
  description:
    "Listen, whisper, or barge on any live call. Every call is recorded and transcribed, so coaching is based on what was actually said.",
};

export default function LiveCoachingPage() {
  return (
    <MarketingShell
      eyebrow="Platform"
      title="Live coaching"
      subtitle="Listen, whisper, or barge on any call in progress — then review what was actually said, not what anyone remembers."
    >
      <MarketingSection heading="Three ways in">
        <p>
          <span className="text-white/80">Listen</span> joins silently; neither
          side knows you are there.{" "}
          <span className="text-white/80">Whisper</span> lets you talk to your
          rep while the prospect hears nothing.{" "}
          <span className="text-white/80">Barge</span> puts you into the
          conversation when a deal needs saving.
        </p>
        <p>
          The sales floor shows every rep in session and every call in flight,
          so you can drop into the one that matters instead of waiting for a
          post-mortem.
        </p>
      </MarketingSection>

      <MarketingSection heading="Recording and transcription">
        <p>
          Calls are recorded from answer and transcribed automatically. Coaching
          notes attach to the moment they refer to, so a review is a list of
          timestamps rather than a paragraph of recollection.
        </p>
      </MarketingSection>

      <MarketingSection heading="Coaching that compounds">
        <p>
          Objections, talk ratios, and outcomes are tracked per rep over time.
          Patterns surface across calls — the objection nobody handles well, the
          script line that consistently stalls — rather than one manager&apos;s
          impression of one call.
        </p>
      </MarketingSection>
    </MarketingShell>
  );
}
