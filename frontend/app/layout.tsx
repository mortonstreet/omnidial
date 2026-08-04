import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Toaster } from "sonner";
import { themeConfig, generateCSSVariables } from "@/theme.config";
import { GoogleAnalytics } from '@next/third-parties/google';
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "OmniDial | Sales Dialer Built for Closers",
  description: "A powerful, browser-based VoIP sales dialer. Click-to-dial, power dialer, call recording, CRM pipeline, and analytics. Built for SDRs and sales teams who close.",
  keywords: ["sales dialer", "VoIP", "power dialer", "call recording", "SDR tools", "sales software", "CRM"],
  authors: [{ name: "OmniDial" }],
  openGraph: {
    title: "OmniDial | Sales Dialer Built for Closers",
    description: "A powerful, browser-based VoIP sales dialer. Click-to-dial, power dialer, call recording, CRM pipeline, and analytics.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OmniDial | Sales Dialer Built for Closers",
    description: "A powerful, browser-based VoIP sales dialer. Click-to-dial, power dialer, call recording, CRM pipeline, and analytics.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cssVariables = generateCSSVariables(themeConfig);
  const analyticsEnabled =
    process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "true";
  const speedInsightsEnabled =
    process.env.NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS_ENABLED === "true";

  return (
    <html lang="en" style={cssVariables} className="dark">
      <body
        className={`${plusJakarta.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} antialiased grain`}
      >
        <Providers>{children}</Providers>
        {analyticsEnabled && <Analytics />}
        {speedInsightsEnabled && <SpeedInsights />}
        {process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID && process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID !== 'NEXT_PUBLIC_GOOGLE_ANALYTICS_ID' && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} />
        )}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              borderRadius: 0,
              background: '#111111',
              border: '1px solid #262626',
              color: '#fafafa',
              fontFamily: 'var(--font-plus-jakarta)',
            },
          }}
        />
      </body>
    </html>
  );
}
