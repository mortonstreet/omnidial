"use client";

import { Suspense, useState, useEffect } from "react";
import AuthCard from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { organization, useSession, subscription } from "@/lib/auth-client";
import { useCompleteOnboarding, useOnboardingStatus } from "@/hooks/api/useAuth";
import { Building2, ArrowRight, ArrowLeft, AlertCircle, Briefcase, Factory, Check, User } from "lucide-react";
import { getAuthErrorMessage, normalizeAuthErrorCode } from "@/lib/auth-errors";

const ROLE_OPTIONS = [
  "SDR",
  "AE",
  "Founder",
  "VP of Sales",
  "Sales Manager",
  "RevOps",
  "Other",
];

const INDUSTRY_OPTIONS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Real Estate",
  "Manufacturing",
  "Education",
  "Retail / E-Commerce",
  "Other",
];

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const completeOnboardingMutation = useCompleteOnboarding();
  const { data: onboardingStatus } = useOnboardingStatus(!!session);

  const [step, setStep] = useState(1);
  const [name, setName] = useState(session?.user?.name || "");
  const [selectedRole, setSelectedRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canceled = searchParams.get("canceled") === "true";
  const correlationId = searchParams.get("correlationId");
  const authErrorCode = normalizeAuthErrorCode(
    searchParams.get("authError") ?? searchParams.get("error"),
  );

  useEffect(() => {
    if (!authErrorCode) return;
    toast.error(getAuthErrorMessage(authErrorCode, correlationId));
  }, [authErrorCode, correlationId]);

  // Check if user accepted an invitation (has an org already)
  const [hasInvitation] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("pendingInvitation");
    return !!stored;
  });

  // Read plan selection from localStorage
  const [planSelection] = useState<{
    plan: string;
    interval: string;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("pendingPlanSelection");
    return stored ? JSON.parse(stored) : null;
  });

  const totalSteps = hasInvitation ? 1 : planSelection ? 3 : 2;

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48);

  const handleOrgNameChange = (name: string) => {
    setOrgName(name);
    setSlug(generateSlug(name));
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!session && typeof window !== "undefined") {
      const timeout = setTimeout(() => {
        if (!session) {
          const loginUrl = new URL("/login", window.location.origin);
          if (authErrorCode) {
            loginUrl.searchParams.set("authError", authErrorCode);
          }
          if (correlationId) {
            loginUrl.searchParams.set("correlationId", correlationId);
          }
          router.push(`${loginUrl.pathname}${loginUrl.search}`);
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [session, router, authErrorCode, correlationId]);

  // Pre-fill name from session (Google OAuth provides name automatically)
  useEffect(() => {
    if (session?.user?.name && !name) {
      setName(session.user.name);
    }
  }, [session?.user?.name, name]);

  // If onboarding is already complete or user is superadmin, redirect to dashboard
  useEffect(() => {
    if (onboardingStatus?.onboardingComplete || session?.user?.role === "superadmin") {
      router.push("/dashboard");
    }
  }, [onboardingStatus, session, router]);

  const finalRole = selectedRole === "Other" ? customRole : selectedRole;
  const finalIndustry = selectedIndustry === "Other" ? customIndustry : selectedIndustry;

  const handleNext = async () => {
    if (step === 1) {
      if (!finalRole || !finalIndustry) {
        toast.error("Please select your role and industry.");
        return;
      }
      if (hasInvitation) {
        // Invitation flow: just save and go to dashboard
        await handleSaveOnboarding();
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!orgName.trim() || !slug.trim()) {
        toast.error("Please enter an organization name.");
        return;
      }
      if (planSelection) {
        // Pricing flow: save onboarding, create org, then go to billing
        await handleSaveOnboardingAndCreateOrg();
      } else {
        // Direct signup: save onboarding, create org, go to dashboard
        await handleSaveOnboardingAndCreateOrg();
      }
    }
  };

  const handleSaveOnboarding = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboardingMutation.mutateAsync({
        ...(name.trim() ? { name: name.trim() } : {}),
        role: finalRole,
        industry: finalIndustry,
      });
      localStorage.removeItem("pendingInvitation");
      toast.success("Welcome aboard!");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveOnboardingAndCreateOrg = async () => {
    setIsSubmitting(true);
    try {
      // Save onboarding answers
      await completeOnboardingMutation.mutateAsync({
        ...(name.trim() ? { name: name.trim() } : {}),
        role: finalRole,
        industry: finalIndustry,
      });

      // Create the organization
      const orgResult = await organization.create({
        name: orgName.trim(),
        slug: slug.trim(),
      });

      if (orgResult.error) {
        toast.error(orgResult.error.message || "Failed to create organization");
        setIsSubmitting(false);
        return;
      }

      const orgId = orgResult.data?.id;
      if (!orgId) {
        toast.error("Organization created but ID not returned");
        setIsSubmitting(false);
        return;
      }

      // Set as active org
      await organization.setActive({ organizationId: orgId });

      if (planSelection) {
        // Pricing flow: redirect to Stripe checkout
        const plan = planSelection.plan || "pro";
        const interval = planSelection.interval || "month";
        const planName = `${plan}-${interval === "year" ? "annual" : "monthly"}`;

        const checkoutResult = await subscription.upgrade({
          plan: planName,
          referenceId: orgId,
          successUrl: `${window.location.origin}/dashboard?welcome=true`,
          cancelUrl: `${window.location.origin}/onboarding?canceled=true`,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = checkoutResult as any;
        if (result?.error) {
          toast.error(result.error.message || "Failed to start checkout");
          setIsSubmitting(false);
          return;
        }

        if (result?.data?.url) {
          localStorage.removeItem("pendingPlanSelection");
          window.location.href = result.data.url;
        }
      } else {
        // Direct signup: go to dashboard
        toast.success("Welcome aboard!");
        router.push("/dashboard?welcome=true");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return (
      <AuthCard title="Loading...">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Loading your session...</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={step === 1 ? "Tell us about yourself" : "Set up your organization"}
      subtitle={
        step === 1
          ? `Step ${step} of ${totalSteps} — Help us personalize your experience`
          : `Step ${step} of ${totalSteps} — ${planSelection ? "One last step before your trial begins" : "Create your workspace"}`
      }
    >
      {canceled && step === 2 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-3 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Checkout was canceled</p>
            <p className="mt-1">No worries! You can try again below.</p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mb-4 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary">
          Welcome, {session.user?.name || "there"}! A few quick questions to get you started.
        </div>
      )}

      {/* Step 1: About You */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              Full name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
            />
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              What&apos;s your role?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                    selectedRole === role
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedRole === role && <Check className="w-3.5 h-3.5" />}
                    {role}
                  </span>
                </button>
              ))}
            </div>
            {selectedRole === "Other" && (
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Enter your role"
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
              />
            )}
          </div>

          {/* Industry Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Factory className="w-4 h-4" />
              What industry are you in?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRY_OPTIONS.map((industry) => (
                <button
                  key={industry}
                  type="button"
                  onClick={() => setSelectedIndustry(industry)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                    selectedIndustry === industry
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedIndustry === industry && <Check className="w-3.5 h-3.5" />}
                    {industry}
                  </span>
                </button>
              ))}
            </div>
            {selectedIndustry === "Other" && (
              <input
                type="text"
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
                placeholder="Enter your industry"
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
              />
            )}
          </div>
        </div>
      )}

      {/* Step 2: Organization */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="orgName" className="text-sm font-medium text-foreground">
              Organization name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => handleOrgNameChange(e.target.value)}
                placeholder="Acme Sales Inc."
                required
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="slug" className="text-sm font-medium text-foreground">
              URL slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">omnidial.io/</span>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="acme-sales"
                required
                className="flex-1 h-11 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
              />
            </div>
          </div>

          {planSelection && (
            <p className="text-xs text-center text-muted-foreground">
              You&apos;ll be redirected to Stripe to enter your payment details.
              Your 14-day free trial starts immediately.
            </p>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(step - 1)}
            className="flex-1 h-11 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
        <Button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting}
          className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors group"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Setting up...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {step < totalSteps
                ? "Continue"
                : planSelection
                  ? "Continue to billing"
                  : "Get started"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          )}
        </Button>
      </div>
    </AuthCard>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <OnboardingPageContent />
    </Suspense>
  );
}
