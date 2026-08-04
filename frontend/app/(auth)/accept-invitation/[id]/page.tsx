"use client";
import { Suspense, useEffect, useState } from "react";
import { useSession, signOut, organization } from "@/lib/auth-client";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import AuthCard from "@/components/AuthCard";
import { Button } from '@/components/ui/button';
import { buildInvitationCallbackPath, DEFAULT_AUTH_CALLBACK_PATH } from "@/lib/auth-callback";
import { getAuthErrorMessage, normalizeAuthErrorCode, type AuthErrorCode } from "@/lib/auth-errors";

function mapInvitationErrorToCode(errorMessage: string): AuthErrorCode {
  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes("recipient") ||
    normalized.includes("invited email") ||
    normalized.includes("not the recipient")
  ) {
    return "AUTH_INVITE_EMAIL_MISMATCH";
  }
  if (
    normalized.includes("invitation not found") ||
    normalized.includes("invitation is no longer valid") ||
    normalized.includes("invalid") ||
    normalized.includes("expired")
  ) {
    return "AUTH_INVITE_INVALID";
  }
  return "AUTH_FAILURE_TRANSIENT";
}

function AcceptInvitationContent() {
  const { data: session, isPending, refetch } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const invitationId = params.id as string;
  const invitedEmail = searchParams.get("email");
  const correlationId = searchParams.get("correlationId");
  const authErrorCode = normalizeAuthErrorCode(
    searchParams.get("authError") ?? searchParams.get("error"),
  );
  const [isAccepting, setIsAccepting] = useState(false);
  const [invitationAccepted, setInvitationAccepted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Check if logged-in user email matches invitation email
  const userEmail = session?.user?.email?.toLowerCase();
  const targetEmail = invitedEmail?.toLowerCase();
  const emailMismatch = session && targetEmail && userEmail !== targetEmail;

  useEffect(() => {
    if (!authErrorCode) return;
    toast.error(getAuthErrorMessage(authErrorCode, correlationId));
  }, [authErrorCode, correlationId]);

  useEffect(() => {
    // If still loading, do nothing
    if (isPending) return;

    // If not logged in, redirect to login with invitation params
    // Login page will handle signup redirect if user doesn't exist
    if (!session) {
      setRedirecting(true);
      const invitationPath =
        buildInvitationCallbackPath(invitationId, invitedEmail) ||
        DEFAULT_AUTH_CALLBACK_PATH;
      const loginUrl = `/login?inviteId=${invitationId}&email=${encodeURIComponent(invitedEmail || '')}&redirect=${encodeURIComponent(invitationPath)}`;
      router.push(loginUrl);
    }
  }, [session, isPending, invitationId, router, invitedEmail]);

  const handleSignOutAndContinue = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      // Redirect to signup with invitation params
      const invitationPath =
        buildInvitationCallbackPath(invitationId, invitedEmail) ||
        DEFAULT_AUTH_CALLBACK_PATH;
      const signupUrl = `/signup?inviteId=${invitationId}&email=${encodeURIComponent(invitedEmail || '')}&redirect=${encodeURIComponent(invitationPath)}`;
      router.push(signupUrl);
    } catch {
      toast.error("Failed to sign out");
      setIsSigningOut(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitationId) {
      toast.error("Invalid invitation link");
      return;
    }

    // Double check email matches
    if (emailMismatch) {
      toast.error("Please sign in with the invited email address");
      return;
    }

    setIsAccepting(true);

    try {
      // Use the better-auth organization client to accept invitation
      const result = await organization.acceptInvitation({
        invitationId,
      });

      if (result.error) {
        const rawMessage = result.error.message || "Failed to accept invitation";
        const mappedCode = mapInvitationErrorToCode(rawMessage);

        if ((rawMessage || "").toLowerCase().includes("already") || (rawMessage || "").toLowerCase().includes("member")) {
          toast.error("You are already a member of this organization.");
          setTimeout(() => router.push("/dashboard"), 2000);
        } else {
          toast.error(getAuthErrorMessage(mappedCode));
        }
      } else {
        // Refetch session to update active organization
        await refetch();

        setInvitationAccepted(true);
        toast.success("Invitation accepted successfully!");

        // Set the active organization from the invitation
        if (result.data?.member?.organizationId) {
          await organization.setActive({
            organizationId: result.data.member.organizationId,
          });
        }

        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      }
    } catch (error) {
      console.error("Accept invitation error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  };

  // Show loading state while checking auth
  if (isPending) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show redirecting state
  if (!session || redirecting) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-muted-foreground">Redirecting to sign up...</div>
      </div>
    );
  }

  // Show success state
  if (invitationAccepted) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <AuthCard title="Welcome to the team">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-muted-foreground">
              You&apos;ve successfully joined the organization.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </div>
        </AuthCard>
      </div>
    );
  }

  // Show email mismatch warning
  if (emailMismatch) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <AuthCard title="Wrong Account">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                This invitation was sent to:
              </p>
              <p className="font-semibold text-foreground">{invitedEmail}</p>
              <p className="text-muted-foreground text-sm mt-4">
                You&apos;re currently signed in as:
              </p>
              <p className="font-medium text-foreground">{session.user?.email}</p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleSignOutAndContinue}
                disabled={isSigningOut}
                className="w-full"
              >
                {isSigningOut ? "Signing out..." : `Sign out and continue as ${invitedEmail}`}
              </Button>

              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                className="w-full"
              >
                Stay signed in as {session.user?.email}
              </Button>
            </div>
          </div>
        </AuthCard>
      </div>
    );
  }

  // Show accept invitation UI
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <AuthCard title="Accept Invitation">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              You&apos;ve been invited to join an organization on OmniDial.
            </p>
            {invitedEmail && (
              <p className="text-sm text-muted-foreground">
                Invitation for: <span className="font-medium text-foreground">{invitedEmail}</span>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleAcceptInvitation}
              disabled={isAccepting}
              className="w-full"
            >
              {isAccepting ? "Accepting..." : "Accept Invitation"}
            </Button>

            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              disabled={isAccepting}
              className="w-full"
            >
              Decline
            </Button>
          </div>
        </div>
      </AuthCard>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
