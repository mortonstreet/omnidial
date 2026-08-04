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

export default function TermsOfService() {
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
        <h1 className="text-3xl sm:text-4xl md:text-5xl text-foreground mb-8 heading-display">Terms of Service</h1>

        <div className="prose prose-invert max-w-none">
          <p className="text-muted-foreground mb-6">
            <strong className="text-foreground">Last updated:</strong> January 15, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground mb-4">
              By accessing or using OmniDial&apos;s services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Description of Services</h2>
            <p className="text-muted-foreground mb-4">
              OmniDial provides browser-based VoIP dialer services, including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Power dialer with auto-advance functionality</li>
              <li>Call recording and playback</li>
              <li>Voicemail drop</li>
              <li>Native CRM with pipeline and deal management</li>
              <li>Team campaigns and round-robin distribution</li>
              <li>Analytics and performance reporting</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground mb-4">
              To use our services, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update any changes to your information</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Acceptable Use</h2>
            <p className="text-muted-foreground mb-4">You agree not to use OmniDial&apos;s services to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Violate any applicable laws or regulations, including TCPA, DNC, and telemarketing laws</li>
              <li>Infringe on the rights of others</li>
              <li>Transmit harmful, fraudulent, or deceptive content</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with the proper functioning of our services</li>
              <li>Use for any illegal telemarketing or spam activities</li>
              <li>Record calls without proper consent where required by law</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Payment Terms</h2>
            <p className="text-muted-foreground mb-4">
              If you subscribe to a paid plan:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Fees are billed in advance on a monthly basis</li>
              <li>All fees are non-refundable unless otherwise stated</li>
              <li>We may change pricing with 30 days&apos; notice</li>
              <li>You are responsible for all applicable taxes</li>
              <li>Usage-based charges (e.g., call minutes) are billed in arrears</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Intellectual Property</h2>
            <p className="text-muted-foreground mb-4">
              OmniDial and its licensors retain all rights to the service, including all software, content, and trademarks. You are granted a limited, non-exclusive license to use the service for its intended purpose.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Data and Privacy</h2>
            <p className="text-muted-foreground mb-4">
              Your use of our services is also governed by our <Link href="/privacy" className="text-primary hover:text-primary/80 underline">Privacy Policy</Link>. By using OmniDial, you consent to our collection and use of data as described therein.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Service Level</h2>
            <p className="text-muted-foreground mb-4">
              OmniDial strives to maintain reliable uptime for our services. However, we do not guarantee uninterrupted access and are not liable for any downtime or service interruptions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              To the maximum extent permitted by law, OmniDial shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Indemnification</h2>
            <p className="text-muted-foreground mb-4">
              You agree to indemnify and hold harmless OmniDial and its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the service or violation of these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Termination</h2>
            <p className="text-muted-foreground mb-4">
              Either party may terminate the service agreement at any time. Upon termination:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Your access to the service will be disabled</li>
              <li>You may request export of your data within 30 days</li>
              <li>Outstanding fees remain payable</li>
              <li>Call recordings will be deleted according to our retention policy</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Modifications to Terms</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to modify these terms at any time. We will notify you of material changes via email or through the service. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">14. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              For questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Email:</strong> legal@omnidial.io
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
