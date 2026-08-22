"use client";

import { SignUp } from "@clerk/nextjs";
import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import {
  buildAuthFlowCallbackPath,
  buildInvitationCallbackPath,
  normalizeAuthCallbackPath,
  DEFAULT_AUTH_CALLBACK_PATH,
} from "@/lib/auth-callback";

function buildQuery(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function SignupPageContent() {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("inviteId");
  const inviteEmail = searchParams.get("email");
  const redirectUrl = searchParams.get("redirect");
  const planParam = searchParams.get("plan");
  const intervalParam = searchParams.get("interval");
  const isSelfService = Boolean(planParam);

  useEffect(() => {
    if (!isSelfService || !planParam) return;
    localStorage.setItem(
      "pendingPlanSelection",
      JSON.stringify({
        plan: planParam,
        interval: intervalParam || "month",
      }),
    );
  }, [intervalParam, isSelfService, planParam]);

  const fallbackRedirectUrl = useMemo(
    () =>
      buildAuthFlowCallbackPath({
        redirectPath: redirectUrl,
        invitationId: inviteId,
        invitationEmail: inviteEmail,
        fallbackPath: "/onboarding",
      }),
    [redirectUrl, inviteId, inviteEmail],
  );

  const safeRedirectPath = normalizeAuthCallbackPath(
    redirectUrl,
    DEFAULT_AUTH_CALLBACK_PATH,
  ).path;
  const inviteRedirectPath =
    buildInvitationCallbackPath(inviteId, inviteEmail) ||
    DEFAULT_AUTH_CALLBACK_PATH;

  const loginQuery = inviteId
    ? buildQuery({
        inviteId,
        email: inviteEmail,
        redirect: redirectUrl ? safeRedirectPath : inviteRedirectPath,
      })
    : "";

  const subtitle = inviteId
    ? "Accept your OmniDial invitation with Clerk"
    : isSelfService
      ? "Start your 14-day free trial"
      : "Create your free account";

  return (
    <AuthCard
      title="Create your account"
      subtitle={subtitle}
      className="[&_.cl-cardBox]:shadow-none [&_.cl-cardBox]:w-full [&_.cl-card]:bg-transparent [&_.cl-card]:shadow-none [&_.cl-card]:border-0 [&_.cl-card]:p-0"
    >
      <SignUp
        routing="path"
        path="/signup"
        signInUrl={`/login${loginQuery}`}
        fallbackRedirectUrl={fallbackRedirectUrl}
        forceRedirectUrl={fallbackRedirectUrl}
      />
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
