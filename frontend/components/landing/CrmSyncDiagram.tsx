import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { LogoIcon } from "@/components/brand/LogoIcon";

/**
 * CRM sync graphic: OmniDial at the centre, CRMs on one side and enrichment
 * vendors on the other. Logos come from logo.dev via CompanyLogo, so the row
 * stays correct without shipping a static asset per vendor.
 */

const CRMS = [
  { name: "HubSpot", domain: "hubspot.com" },
  { name: "Salesforce", domain: "salesforce.com" },
  { name: "Pipedrive", domain: "pipedrive.com" },
  { name: "Attio", domain: "attio.com" },
  { name: "Monday", domain: "monday.com" },
];

const ENRICHMENT = [
  { name: "Apollo", domain: "apollo.io" },
  { name: "ZoomInfo", domain: "zoominfo.com" },
  { name: "Clearbit", domain: "clearbit.com" },
  { name: "Lusha", domain: "lusha.com" },
  { name: "Lead Magic", domain: "leadmagic.io" },
  { name: "Prospeo", domain: "prospeo.io" },
];

function VendorColumn({
  label,
  vendors,
}: {
  label: string;
  vendors: Array<{ name: string; domain: string }>;
}) {
  return (
    <div className="flex-1">
      <p className="mb-4 text-[11px] font-medium uppercase tracking-widest text-white/35">
        {label}
      </p>
      <div className="flex flex-col gap-2">
        {vendors.map((v) => (
          <Card
            key={v.name}
            className="flex flex-row items-center gap-3 border-white/10 bg-white/[0.03] px-3 py-2.5 shadow-none"
          >
            <CompanyLogo company={v.name} website={v.domain} size={22} />
            <span className="text-sm text-white/70">{v.name}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function CrmSyncDiagram() {
  return (
    <div className="mx-auto mt-16 w-full max-w-4xl">
      <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-center sm:gap-8">
        <VendorColumn label="Enrichment" vendors={ENRICHMENT} />

        {/* Centre: OmniDial */}
        <div className="flex flex-col items-center gap-3 px-2">
          <div
            aria-hidden="true"
            className="hidden h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent sm:block"
          />
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-white/15 to-white/5 ring-1 ring-white/10">
            <LogoIcon size={40} />
          </div>
          <span className="text-sm font-medium text-white">OmniDial</span>
          <div
            aria-hidden="true"
            className="hidden h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent sm:block"
          />
        </div>

        <VendorColumn label="CRM" vendors={CRMS} />
      </div>

      <p className="mt-8 text-center text-sm text-white/40">
        Contacts flow in from your enrichment stack, calls and outcomes flow back
        to your CRM. One record, updated in both directions.
      </p>
    </div>
  );
}
