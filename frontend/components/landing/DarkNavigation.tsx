"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Users, Briefcase, FileText, Menu, X, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import OmniDialLogo from "@/components/landing/OmniDialLogo";

const productsMenu = [
  {
    id: "dialer",
    title: "Dialer",
    description: "The complete sales dialing platform",
    icon: Phone,
    href: "/products/dialer",
    external: false,
  },
  {
    id: "enrich",
    title: "Enrich",
    description: "Chrome extension & bulk enrichment",
    icon: Sparkles,
    href: "https://enrich.omnidial.io",
    external: true,
  },
];

const companyMenu = {
  about: [
    { title: "About", description: "Our mission and story", icon: Briefcase, href: "/about" },
    { title: "Careers", description: "Build the future of sales", icon: Users, href: "/careers", badge: "Hiring" },
    { title: "Case Studies", description: "How teams win with OmniDial", icon: FileText, href: "/case-studies" },
  ],
  more: [
    { title: "Blog", href: "/blog" },
    { title: "Contact", href: "/contact" },
  ],
};


export default function DarkNavigation() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  // Close mobile menu on resize to desktop (lg breakpoint = 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
        setMobileExpanded(null);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <OmniDialLogo size={32} showText textSize="md" />
          </Link>

          {/* Center nav - visible at lg (1024px+) where mega menus fit */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Products */}
            <div
              className="relative"
              onMouseEnter={() => setActiveMenu("products")}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <button className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeMenu === "products" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
              }`}>
                Products
                <ChevronDown className="w-4 h-4" />
              </button>

              {activeMenu === "products" && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
                  <div className="bg-[#111111] rounded-2xl shadow-2xl border border-white/10 p-5 w-[420px] grid grid-cols-1 gap-2">
                    {productsMenu.map((item) => {
                      const content = (
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10 text-white group-hover:bg-white group-hover:text-black transition-colors">
                            <item.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-medium text-sm mb-1 text-white">{item.title}</h3>
                            <p className="text-white/50 text-xs leading-relaxed">{item.description}</p>
                          </div>
                        </div>
                      );

                      return item.external ? (
                        <a
                          key={item.id}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-left p-4 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          {content}
                        </a>
                      ) : (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="block text-left p-4 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          {content}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Company */}
            <div
              className="relative"
              onMouseEnter={() => setActiveMenu("company")}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <button className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeMenu === "company" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
              }`}>
                Company
                <ChevronDown className="w-4 h-4" />
              </button>

              {activeMenu === "company" && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
                  <div className="bg-[#111111] rounded-2xl shadow-2xl border border-white/10 p-6 w-[500px] grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">About Us</p>
                      <div className="space-y-1">
                        {companyMenu.about.map((item) => (
                          <Link
                            key={item.title}
                            href={item.href}
                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/60 group-hover:bg-white group-hover:text-black transition-colors">
                              <item.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-normal text-sm text-white">{item.title}</span>
                                {item.badge && (
                                  <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">{item.badge}</span>
                                )}
                              </div>
                              <p className="text-white/50 text-xs">{item.description}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">More</p>
                      <div className="space-y-1">
                        {companyMenu.more.map((item) => (
                          <Link
                            key={item.title}
                            href={item.href}
                            className="block px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                          >
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">
              Pricing
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              href="/contact"
              className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors hidden lg:block"
            >
              Contact sales
            </Link>
            <Link href="/login" className="hidden lg:block">
              <Button className="bg-white text-black hover:bg-white/90 rounded-lg px-4 py-2 text-sm font-medium">
                Sign in
              </Button>
            </Link>

            {/* Mobile menu button - visible below lg (1024px) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay - visible below lg */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 top-16 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu drawer - visible below lg */}
      <div
        className={`lg:hidden fixed top-16 left-0 right-0 bottom-0 bg-[#0a0a0a] z-50 transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full overflow-y-auto pb-20">
          <div className="px-4 sm:px-6 md:px-8 py-4 md:py-6 space-y-2 max-w-2xl mx-auto">
            {/* Products accordion */}
            <div className="border-b border-white/10">
              <button
                onClick={() => setMobileExpanded(mobileExpanded === "products" ? null : "products")}
                className="flex items-center justify-between w-full py-4 text-left"
              >
                <span className="text-base font-medium text-white">Products</span>
                <ChevronRight className={`w-5 h-5 text-white/40 transition-transform ${
                  mobileExpanded === "products" ? "rotate-90" : ""
                }`} />
              </button>
              {mobileExpanded === "products" && (
                <div className="pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {productsMenu.map((item) => {
                    const content = (
                      <>
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white flex-shrink-0">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-sm block text-white">{item.title}</span>
                          <p className="text-white/50 text-xs line-clamp-2">{item.description}</p>
                        </div>
                      </>
                    );

                    return item.external ? (
                      <a
                        key={item.id}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        {content}
                      </a>
                    ) : (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Company accordion */}
            <div className="border-b border-white/10">
              <button
                onClick={() => setMobileExpanded(mobileExpanded === "company" ? null : "company")}
                className="flex items-center justify-between w-full py-4 text-left"
              >
                <span className="text-base font-medium text-white">Company</span>
                <ChevronRight className={`w-5 h-5 text-white/40 transition-transform ${
                  mobileExpanded === "company" ? "rotate-90" : ""
                }`} />
              </button>
              {mobileExpanded === "company" && (
                <div className="pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                    {companyMenu.about.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white flex-shrink-0">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-white">{item.title}</span>
                            {item.badge && (
                              <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full whitespace-nowrap">{item.badge}</span>
                            )}
                          </div>
                          <p className="text-white/50 text-xs line-clamp-2">{item.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-white/10 flex flex-wrap gap-2">
                    {companyMenu.more.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pricing link */}
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between py-4 border-b border-white/10"
            >
              <span className="text-base font-medium text-white">Pricing</span>
              <ChevronRight className="w-5 h-5 text-white/40" />
            </Link>

            {/* Contact sales link */}
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between py-4 border-b border-white/10"
            >
              <span className="text-base font-medium text-white">Contact sales</span>
              <ChevronRight className="w-5 h-5 text-white/40" />
            </Link>
          </div>

          {/* Mobile CTA */}
          <div className="px-4 sm:px-6 md:px-8 py-4 md:py-6 border-t border-white/10 mt-4 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                <Button className="w-full bg-white text-black hover:bg-white/90 rounded-lg px-4 py-3 text-sm font-medium">
                  Sign in
                </Button>
              </Link>
              <Link href="/waitlist" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 rounded-lg px-4 py-3 text-sm font-medium">
                  Join waitlist
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
