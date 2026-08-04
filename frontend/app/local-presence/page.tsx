import type { Metadata } from "next";
import MarketingShell, {
  MarketingSection,
} from "@/components/landing/MarketingShell";

export const metadata: Metadata = {
  title: "Local Presence | OmniDial",
  description:
    "Call from a number that matches your prospect's area code, rotated across a pool so no single number carries the whole campaign.",
};

export default function LocalPresencePage() {
  return (
    <MarketingShell
      eyebrow="Platform"
      title="Local presence"
      subtitle="Call from a number that shares your prospect's area code — rotated across a pool, so no single number carries an entire campaign."
    >
      <MarketingSection heading="Why the number matters">
        <p>
          People answer numbers they recognise. An unfamiliar out-of-state
          number reads as a cold call before anyone says a word. Matching the
          area code removes that first objection.
        </p>
      </MarketingSection>

      <MarketingSection heading="Rotation protects your reputation">
        <p>
          Carrier analytics — Hiya, First Orion, TNS — score numbers on call
          patterns. High volume from one number, short durations, and low answer
          rates all read as spam, and once a number is flagged the label follows
          it.
        </p>
        <p>
          OmniDial spreads volume across a pool and tracks calls per number per
          day, so no single line accumulates the pattern that triggers a flag.
          Numbers are provisioned with CNAM registered, and the pool syncs
          against your carrier account so retired numbers fall out
          automatically.
        </p>
      </MarketingSection>

      <MarketingSection heading="Callbacks come back to you">
        <p>
          Every number in the pool routes inbound calls to the rep who placed
          the original call, matched against the lead record. A prospect calling
          back reaches a person, not a dead line.
        </p>
      </MarketingSection>
    </MarketingShell>
  );
}
