import type { Metadata } from "next";
import MarketingShell, {
  MarketingSection,
} from "@/components/landing/MarketingShell";
import CrmSyncDiagram from "@/components/landing/CrmSyncDiagram";

export const metadata: Metadata = {
  title: "CRM Sync | OmniDial",
  description:
    "Contacts flow in from your enrichment stack, calls and outcomes flow back to your CRM. One record, updated in both directions.",
};

export default function CrmSyncPage() {
  return (
    <MarketingShell
      eyebrow="Platform"
      title="CRM sync"
      subtitle="Contacts flow in from your enrichment stack. Calls, dispositions, and recordings flow back to your CRM. Nobody retypes anything."
    >
      <CrmSyncDiagram />

      <MarketingSection heading="Both directions, one record">
        <p>
          Pull contacts and companies from your CRM into a dialing list, then
          push every call outcome back onto the same record. Dispositions,
          durations, notes, and recording links land where your team already
          works.
        </p>
        <p>
          Sync is incremental and conflict-aware — a lead edited in your CRM
          while a rep is on the phone with them will not overwrite the call that
          just happened.
        </p>
      </MarketingSection>

      <MarketingSection heading="Enrichment before the dial">
        <p>
          Connect the enrichment vendors you already pay for. OmniDial resolves
          mobile numbers and verifies contacts before a lead enters a session,
          so reps spend their time on connects instead of dead lines.
        </p>
      </MarketingSection>

      <MarketingSection heading="Bring your own stack">
        <p>
          Integrations authenticate over OAuth and are scoped to the objects
          they need. Nothing is copied into a proprietary format you cannot
          export, and disconnecting an integration leaves your CRM exactly as it
          was.
        </p>
      </MarketingSection>
    </MarketingShell>
  );
}
