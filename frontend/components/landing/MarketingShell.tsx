import type { ReactNode } from "react";
import DarkNavigation from "@/components/landing/DarkNavigation";
import OmniDialFooter from "@/components/landing/OmniDialFooter";

interface MarketingShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}

/** Nav + hero band + footer, shared by every marketing sub-page. */
export default function MarketingShell({
  eyebrow,
  title,
  subtitle,
  children,
}: MarketingShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-white">
      <DarkNavigation />

      <main className="flex-1 px-6 pt-32 pb-24">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-white/55">{subtitle}</p>
        </div>

        {children}
      </main>

      <OmniDialFooter />
    </div>
  );
}

/** A titled prose block, used for the body copy on every sub-page. */
export function MarketingSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto mt-14 w-full max-w-3xl">
      <h2 className="font-display text-xl font-semibold tracking-tight text-white">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-white/55">
        {children}
      </div>
    </section>
  );
}
