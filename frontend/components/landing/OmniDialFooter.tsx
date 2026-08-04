import Link from "next/link";
import { LogoIcon } from "@/components/brand/LogoIcon";
import {
  ClaudeIcon,
  GeminiIcon,
  GrokIcon,
  OpenAIIcon,
  PerplexityIcon,
} from "@/components/marketing/ai-brand-icons";

/**
 * Dark footer after the Revcenter reference: mark + closing pitch + CTA pair up
 * top, link columns, an "Ask about OmniDial on" AI-search row, a spacious band
 * for the wordmark, then the legal line with socials bottom-right.
 */

import { BOOKING_URL, getSignInUrl } from "@/lib/marketing-links";

const COLUMNS: Array<{
  heading: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}> = [
  {
    heading: "Platform",
    links: [
      { label: "Parallel dialer", href: "/parallel-dialer" },
      { label: "Local presence", href: "/local-presence" },
      { label: "Live coaching", href: "/live-coaching" },
      { label: "CRM sync", href: "/crm-sync" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
  {
    heading: "Get in touch",
    links: [
      { label: "Request access", href: BOOKING_URL, external: true },
      { label: "Book a call", href: BOOKING_URL, external: true },
    ],
  },
];

// Each tile deep-links an AI product with a prefilled question about OmniDial.
const ASK_QUERY = encodeURIComponent(
  "What is OmniDial (omnidial.io) and how does it help sales teams dial more prospects and connect with more buyers?",
);

const ASK_PLATFORMS: Array<{
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { label: "ChatGPT", href: `https://chatgpt.com/?q=${ASK_QUERY}`, Icon: OpenAIIcon },
  { label: "Claude", href: `https://claude.ai/new?q=${ASK_QUERY}`, Icon: ClaudeIcon },
  {
    label: "Perplexity",
    href: `https://www.perplexity.ai/search?q=${ASK_QUERY}`,
    Icon: PerplexityIcon,
  },
  // Gemini's app has no query-prefill URL; Google AI Mode (udm=50) is
  // Gemini-powered and does actually ask the question.
  { label: "Gemini", href: `https://www.google.com/search?udm=50&q=${ASK_QUERY}`, Icon: GeminiIcon },
  { label: "Grok", href: `https://grok.com/?q=${ASK_QUERY}`, Icon: GrokIcon },
];

export default function OmniDialFooter() {
  return (
    <footer className="bg-gradient-to-b from-[#141316] to-[#0a0a0a] text-[#b3aeb1]">
      <div className="mx-auto w-full max-w-6xl px-6 pt-20 pb-10 sm:px-10 sm:pt-24">
        {/* Top band — mark, closing pitch, CTAs */}
        <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-b from-white/20 to-white/5 ring-1 ring-white/10">
              <LogoIcon size={24} />
            </span>
            <h2 className="mt-8 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              More calls. More connects.
            </h2>
            <p className="font-display text-3xl font-semibold tracking-tight text-[#8a858a] sm:text-4xl">
              More closes.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 pb-1">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-4 py-2 text-sm font-medium text-black transition-transform duration-200 hover:scale-[1.02]
                         bg-[linear-gradient(110deg,#ffffff_0%,#cfcace_45%,#ffffff_100%)]"
            >
              Request access
            </a>
            <a
              href={getSignInUrl()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10
                         bg-[linear-gradient(110deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.14)_100%)]"
            >
              Sign in
            </a>
          </div>
        </div>

        {/* Link columns */}
        <div className="mt-16 grid grid-cols-2 gap-10 border-t border-white/10 pt-12 sm:grid-cols-3 sm:gap-16">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <div className="text-[11px] font-medium uppercase tracking-widest text-[#8a858a]">
                {col.heading}
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[14px] text-[#d4cfd2] transition-colors hover:text-white"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-[14px] text-[#d4cfd2] transition-colors hover:text-white"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Ask an AI about OmniDial */}
        <div className="mt-16 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
          <span className="text-[13.5px] text-[#8a858a]">Ask about OmniDial on</span>
          <div className="flex items-center gap-2">
            {ASK_PLATFORMS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ask about OmniDial on ${label}`}
                title={`Ask about OmniDial on ${label}`}
                className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-[#d4cfd2] ring-1 ring-white/10 transition-colors hover:bg-white/15 hover:text-white"
              >
                <Icon className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>

        {/* The wordmark's moment — big, quiet, centered */}
        <div className="flex items-center justify-center py-24 sm:py-32">
          <div className="flex items-center gap-5 opacity-90">
            <LogoIcon size={64} />
            <span className="font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              OmniDial
            </span>
          </div>
        </div>

        {/* Legal line + socials */}
        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[12.5px] text-[#8a858a]">
              &copy; {new Date().getFullYear()} OmniDial. All rights reserved.
            </span>
            <Link
              href="/privacy"
              className="text-[12.5px] text-[#8a858a] transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://x.com/omnidial"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="OmniDial on X"
              className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-[#b3aeb1] transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/omnidial"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="OmniDial on LinkedIn"
              className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-[#b3aeb1] transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
