"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";

const getAppUrl = (path: string) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl || appUrl.includes("localhost")) {
    return path;
  }
  return `${appUrl}${path}`;
};

export default function PrivacyPolicy() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <Link href="/" className="flex items-center">
              <Logo variant="full" />
            </Link>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-3">
              <a
                href={getAppUrl("/login")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
              >
                Sign in
              </a>
              <Button asChild>
                <a href={getAppUrl("/signup")}>Start</a>
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="sm:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="sm:hidden py-4 border-t border-border space-y-3">
              <a
                href={getAppUrl("/login")}
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Sign in
              </a>
              <Button asChild className="w-full">
                <a href={getAppUrl("/signup")}>Start</a>
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl md:text-5xl text-foreground mb-8 heading-display">Privacy Policy</h1>

        <div className="prose prose-invert max-w-none">
          <p className="text-muted-foreground mb-6">
            <strong className="text-foreground">Last updated:</strong> January 15, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-muted-foreground mb-4">
              OmniDial (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our browser-based VoIP dialer services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-4">We may collect the following types of information:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong className="text-foreground">Personal Information:</strong> Name, email address, phone number, and business information you provide when creating an account.</li>
              <li><strong className="text-foreground">Call Data:</strong> Call recordings, call logs, voicemail drops, and metadata associated with calls made through our platform.</li>
              <li><strong className="text-foreground">CRM Data:</strong> Lead information, contact details, pipeline data, and deal history stored in our native CRM.</li>
              <li><strong className="text-foreground">Usage Data:</strong> Information about how you interact with our services, including log data, device information, and analytics.</li>
              <li><strong className="text-foreground">Integration Data:</strong> Data from third-party services you connect to OmniDial, such as external CRM systems.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">We use the collected information to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Provide, maintain, and improve our power dialer and CRM services</li>
              <li>Process and complete transactions</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Generate analytics and performance metrics for your campaigns</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground mb-4">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li><strong className="text-foreground">Service Providers:</strong> Third-party vendors who assist in providing our services (e.g., telephony providers, cloud hosting)</li>
              <li><strong className="text-foreground">Business Partners:</strong> With your consent, to facilitate integrations you request</li>
              <li><strong className="text-foreground">Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Data Security</h2>
            <p className="text-muted-foreground mb-4">
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Encryption for all data in transit and at rest</li>
              <li>Secure call recording storage</li>
              <li>Access controls and authentication requirements</li>
              <li>Regular security assessments</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground mb-4">
              We retain your information for as long as your account is active or as needed to provide services. Call recordings are retained according to your account settings. You may request deletion of your data at any time by contacting us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground mb-4">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Email:</strong> privacy@omnidial.io
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 sm:py-10 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">&copy; OmniDial 2026. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
