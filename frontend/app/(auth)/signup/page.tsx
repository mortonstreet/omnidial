"use client";
import { Suspense, useEffect, useState } from "react";
import AuthCard from "@/components/AuthCard";
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { useMagicLink, useSignInSocial } from "@/hooks/api/useAuth";
import { Mail, ArrowRight } from "lucide-react";
import {
  buildAuthFlowCallbackPath,
  buildInvitationCallbackPath,
  normalizeAuthCallbackPath,
  DEFAULT_AUTH_CALLBACK_PATH,
} from "@/lib/auth-callback";
import {
  extractAuthErrorDetails,
  getAuthErrorMessage,
  normalizeAuthErrorCode,
} from "@/lib/auth-errors";

function SignupPageContent() {
  const searchParams = useSearchParams();

  // Get invitation ID and email from query params
  const inviteId = searchParams.get("inviteId");
  const emailParam = searchParams.get("email");
  const redirectUrl = searchParams.get("redirect");
  const correlationId = searchParams.get("correlationId");
  const authErrorCode = normalizeAuthErrorCode(
    searchParams.get("authError") ?? searchParams.get("error"),
  );

  // Self-service plan params
  const planParam = searchParams.get("plan");
  const intervalParam = searchParams.get("interval");
  const isSelfService = !!planParam;

  const safeRedirectPath = normalizeAuthCallbackPath(
    redirectUrl,
    DEFAULT_AUTH_CALLBACK_PATH,
  ).path;
  const inviteRedirectPath =
    buildInvitationCallbackPath(inviteId, emailParam) || DEFAULT_AUTH_CALLBACK_PATH;

  const [email, setEmail] = useState(emailParam || "");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const magicLinkMutation = useMagicLink();
  const socialSignInMutation = useSignInSocial();

  useEffect(() => {
    if (!authErrorCode) return;
    toast.error(getAuthErrorMessage(authErrorCode, correlationId));
  }, [authErrorCode, correlationId]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email address.");

    const callbackURL = buildAuthFlowCallbackPath({
      redirectPath: redirectUrl,
      invitationId: inviteId,
      invitationEmail: email || emailParam,
      fallbackPath: "/onboarding",
    });

    // Store plan selection for self-service flow
    if (isSelfService) {
      localStorage.setItem("pendingPlanSelection", JSON.stringify({
        plan: planParam,
        interval: intervalParam || "month",
      }));
    }

    magicLinkMutation.mutate(
      { email, callbackURL },
      {
        onSuccess: (result) => {
          if (result.error) {
            const details = extractAuthErrorDetails(result.error);
            if (details.code) {
              toast.error(getAuthErrorMessage(details.code, details.correlationId));
            } else {
              toast.error(details.message || "Failed to send sign-up link");
            }
          } else {
            setMagicLinkSent(true);
            toast.success("Check your email for the sign-up link!");
          }
        },
        onError: (error) => {
          const details = extractAuthErrorDetails(error);
          if (details.code) {
            toast.error(getAuthErrorMessage(details.code, details.correlationId));
          } else {
            toast.error("Failed to send sign-up link. Please try again.");
          }
        },
      }
    );
  }

  async function handleSocialSignUp() {
    const callbackURL = buildAuthFlowCallbackPath({
      redirectPath: redirectUrl,
      invitationId: inviteId,
      invitationEmail: emailParam,
      fallbackPath: "/onboarding",
    });

    if (!inviteId && isSelfService) {
      localStorage.setItem("pendingPlanSelection", JSON.stringify({
        plan: planParam,
        interval: intervalParam || "month",
      }));
    }

    socialSignInMutation.mutate(
      { provider: 'google', callbackURL },
      {
        onError: () => {
          toast.error("Failed to sign up with Google");
        },
      }
    );
  }

  const subtitle = inviteId
    ? "Complete your invitation"
    : isSelfService
      ? "Start your 14-day free trial"
      : "Create your free account";

  const headerMessage = inviteId
    ? "Please sign up to accept your invitation."
    : isSelfService
      ? `You selected the ${planParam?.charAt(0).toUpperCase()}${planParam?.slice(1)} plan. Create your account to get started.`
      : null;

  return (
    <AuthCard
      title="Create your account"
      subtitle={subtitle}
    >
      {headerMessage && (
        <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary">
          {headerMessage}
        </div>
      )}

      {/* Magic link sent confirmation */}
      {magicLinkSent ? (
        <div className="space-y-4">
          <div className="p-6 rounded-xl bg-muted border border-border text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <p className="text-foreground font-medium">Check your email</p>
            <p className="text-sm text-muted-foreground mt-2">
              We sent a sign-up link to <span className="font-medium text-foreground">{email}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              The link will expire in 10 minutes.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMagicLinkSent(false)}
            className="w-full"
          >
            Back to sign up
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Google Sign Up (primary) */}
          <button
            type="button"
            onClick={handleSocialSignUp}
            disabled={socialSignInMutation.isPending}
            className="w-full flex items-center justify-center gap-3 h-11 border border-border rounded-xl hover:bg-muted transition-colors font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase tracking-wider">or continue with email</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          {/* Email + Magic Link Form */}
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Work email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => !inviteId && setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  readOnly={!!inviteId}
                  className={`w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors ${inviteId ? 'bg-muted cursor-not-allowed' : ''}`}
                />
              </div>
              {inviteId && (
                <p className="text-xs text-muted-foreground">
                  This email is linked to your invitation and cannot be changed.
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={magicLinkMutation.isPending}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors group"
            >
              {magicLinkMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending link...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Send sign-up link
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              )}
            </Button>
          </form>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground pt-2">
            By creating an account, you agree to our{" "}
            <a href="/terms" className="text-primary hover:text-primary/80">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="text-primary hover:text-primary/80">Privacy Policy</a>
          </p>

          {/* Sign in link */}
          <p className="text-center text-sm text-muted-foreground pt-2">
            Already have an account?{" "}
            <a
              className="text-primary hover:text-primary/80 font-medium transition-colors"
              href={inviteId
                ? `/login?inviteId=${inviteId}&email=${encodeURIComponent(emailParam || "")}&redirect=${encodeURIComponent(redirectUrl ? safeRedirectPath : inviteRedirectPath)}`
                : "/login"
              }
            >
              Sign in
            </a>
          </p>
        </div>
      )}
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

export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SignupPageContent />
    </Suspense>
  );
}
