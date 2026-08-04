import type { Metadata } from "next";
import MarketingShell, {
  MarketingSection,
} from "@/components/landing/MarketingShell";

export const metadata: Metadata = {
  title: "Parallel Dialer | OmniDial",
  description:
    "Dial several lines at once and connect your rep to whoever picks up first. Answering machines are filtered before they ever reach a human.",
};

export default function ParallelDialerPage() {
  return (
    <MarketingShell
      eyebrow="Platform"
      title="Parallel dialer"
      subtitle="Dial several numbers at once and connect your rep to whoever answers first. The rest hang up before anyone notices."
    >
      <MarketingSection heading="How it works">
        <p>
          A rep starts a session and joins a conference. OmniDial dials the next
          batch of leads from the list — two to five lines at a time — and the
          moment a human answers, that call is bridged into the rep&apos;s
          conference and the remaining lines drop.
        </p>
        <p>
          Answering machine detection runs on every leg, so voicemails are
          identified and dispositioned without a rep ever hearing them. The
          session keeps feeding itself: as soon as a call ends, the next batch
          goes out.
        </p>
      </MarketingSection>

      <MarketingSection heading="Line count is a dial, not a switch">
        <p>
          More lines mean more connects per hour and a higher chance two people
          answer at once. OmniDial tracks connects and abandons per session, so
          you can tune the ratio against your own numbers rather than a vendor
          default.
        </p>
      </MarketingSection>

      <MarketingSection heading="Built for the way reps actually work">
        <p>
          Sessions pause and resume. Dispositions are one keystroke. Notes and
          outcomes attach to the lead, not to a call log nobody reads. Managers
          can listen, whisper, or barge from the sales floor without
          interrupting the flow.
        </p>
      </MarketingSection>
    </MarketingShell>
  );
}
