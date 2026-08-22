"use client";

import { SignIn } from "@clerk/nextjs";
import { Suspense, useMemo } from "react";
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

function LoginPageContent() {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("inviteId");
  const inviteEmail = searchParams.get("email");
  const redirectUrl = searchParams.get("redirect");

  const fallbackRedirectUrl = useMemo(
    () =>
      buildAuthFlowCallbackPath({
        redirectPath: redirectUrl,
        invitationId: inviteId,
        invitationEmail: inviteEmail,
        fallbackPath: "/dashboard",
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

  const signupQuery = inviteId
    ? buildQuery({
        inviteId,
        email: inviteEmail,
        redirect: redirectUrl ? safeRedirectPath : inviteRedirectPath,
      })
    : "";

  return (
    <AuthCard
      title="Welcome back"
      subtitle={
        inviteId
          ? "Sign in with Clerk to accept your OmniDial invitation"
          : "Sign in to your OmniDial account"
      }
      className="[&_.cl-cardBox]:shadow-none [&_.cl-cardBox]:w-full [&_.cl-card]:bg-transparent [&_.cl-card]:shadow-none [&_.cl-card]:border-0 [&_.cl-card]:p-0"
    >
      <SignIn
        routing="path"
        path="/login"
        signUpUrl={`/signup${signupQuery}`}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginPageContent />
    </Suspense>
  );
}
