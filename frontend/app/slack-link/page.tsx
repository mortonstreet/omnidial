"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { get, post } from "@/lib/api";
import { ENDPOINTS } from "@/lib/config";
import { useSession } from "@/lib/auth-client";
import { Loader2, Building2, Check, AlertCircle } from "lucide-react";

interface WorkspaceInfo {
  id: string;
  teamName: string;
  teamDomain?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  hasSlackConnected: boolean;
}

interface ValidateResponse {
  valid: boolean;
  workspace: WorkspaceInfo;
  expiresAt: string;
}

interface OrganizationsResponse {
  organizations: Organization[];
  workspace: { id: string; teamName: string } | null;
}

interface LinkCompleteResponse {
  success: boolean;
  workspace?: {
    id: string;
    teamId: string;
    teamName: string;
  };
}

function SlackLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const { data: session, isPending: isSessionLoading } = useSession();

  const [isValidating, setIsValidating] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const validateToken = useCallback(async () => {
    if (!token) return;
    try {
      const response = await get<ValidateResponse>(ENDPOINTS.SLACK.LINK_VALIDATE(token));
      setWorkspace(response.workspace);
    } catch {
      setLinkError("This link has expired or is invalid. Please click the link button in Slack again.");
    } finally {
      setIsValidating(false);
    }
  }, [token]);

  const fetchOrganizations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await get<OrganizationsResponse>(ENDPOINTS.SLACK.LINK_ORGANIZATIONS(token));
      setOrganizations(response.organizations);
    } catch {
      setLinkError("Failed to load your organizations. Please try again.");
    }
  }, [token]);

  // Validate token on mount
  useEffect(() => {
    if (error) {
      setLinkError(error === "rate_limited"
        ? "Too many link attempts. Please wait a few minutes and try again from Slack."
        : "An error occurred. Please try again from Slack.");
      setIsValidating(false);
      return;
    }

    if (!token) {
      setLinkError("Missing link token. Please click the link button in Slack again.");
      setIsValidating(false);
      return;
    }

    validateToken();
  }, [token, error, validateToken]);

  // Fetch organizations once authenticated
  useEffect(() => {
    if (session && token && workspace && organizations.length === 0) {
      fetchOrganizations();
    }
  }, [session, token, workspace, organizations.length, fetchOrganizations]);

  // Auto-select if only one org
  useEffect(() => {
    if (organizations.length === 1 && !organizations[0].hasSlackConnected) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations]);

  const handleLinkOrganization = async () => {
    if (!selectedOrgId || !token) return;

    setIsLinking(true);
    try {
      const response = await post<LinkCompleteResponse>(ENDPOINTS.SLACK.LINK_COMPLETE, {
        token,
        organizationId: selectedOrgId,
      });

      if (response.success) {
        setLinkSuccess(true);
        toast.success("Slack workspace connected successfully!");
      } else {
        setLinkError("Failed to link workspace. Please try again.");
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status === 409) {
        setLinkError("This organization already has a Slack workspace connected.");
      } else if (apiError.response?.status === 403) {
        setLinkError("You don't have permission to connect Slack to this organization.");
      } else {
        setLinkError("Failed to link workspace. Please try again.");
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleLogin = () => {
    // Redirect to login with return URL
    const returnUrl = `/slack-link?token=${token}`;
    router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  // Loading state
  if (isValidating || isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Validating link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (linkError && !linkSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Link Failed</CardTitle>
            <CardDescription>{linkError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => window.close()}
            >
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (linkSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>Successfully Connected!</CardTitle>
            <CardDescription>
              Your Slack workspace &quot;{workspace?.teamName}&quot; is now connected to OmniDial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              You can close this window and return to Slack. Use <code className="bg-muted px-1 py-0.5 rounded">/omnidial help</code> to see available commands.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => window.close()}
              >
                Close Window
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push('/dashboard/settings?tab=integrations')}
              >
                Go to Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <SlackLogo className="h-10 w-10" />
              <span className="text-2xl text-muted-foreground">+</span>
              <GTMLogo className="h-10 w-10" />
            </div>
            <CardTitle>Connect Slack to OmniDial</CardTitle>
            <CardDescription>
              {workspace ? (
                <>Connect workspace &quot;{workspace.teamName}&quot; to your OmniDial organization</>
              ) : (
                "Sign in to connect your Slack workspace"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={handleLogin}>
              Sign in to OmniDial
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Don&apos;t have an account?{" "}
              <a href="/signup" className="text-primary hover:underline">
                Sign up
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Organization selection
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <SlackLogo className="h-10 w-10" />
            <span className="text-2xl text-muted-foreground">+</span>
            <GTMLogo className="h-10 w-10" />
          </div>
          <CardTitle>Select Organization</CardTitle>
          <CardDescription>
            Choose which organization to connect to &quot;{workspace?.teamName}&quot;
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {organizations.length === 0 ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading organizations...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  disabled={org.hasSlackConnected}
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedOrgId === org.id
                      ? "border-primary bg-primary/5"
                      : org.hasSlackConnected
                      ? "border-border bg-muted cursor-not-allowed opacity-60"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {org.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{org.name}</p>
                    {org.hasSlackConnected && (
                      <p className="text-xs text-muted-foreground">Already has Slack connected</p>
                    )}
                  </div>
                  {selectedOrgId === org.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!selectedOrgId || isLinking}
            onClick={handleLinkOrganization}
          >
            {isLinking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Connecting...
              </>
            ) : (
              "Connect Workspace"
            )}
          </Button>

          {organizations.every(org => org.hasSlackConnected) && organizations.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              All your organizations already have Slack connected. You can disconnect an existing workspace in{" "}
              <a href="/dashboard/settings?tab=integrations" className="text-primary hover:underline">
                Settings
              </a>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SlackLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 127 127" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80z" fill="#E01E5A"/>
      <path d="M33.9 80c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A"/>
      <path d="M47.1 27c-7.3 0-13.2-5.9-13.2-13.2C33.9 6.5 39.8.6 47.1.6c7.3 0 13.2 5.9 13.2 13.2V27H47.1z" fill="#36C5F0"/>
      <path d="M47.1 33.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H14c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1z" fill="#36C5F0"/>
      <path d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9z" fill="#2EB67D"/>
      <path d="M93.2 46.9c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V14c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v32.9z" fill="#2EB67D"/>
      <path d="M80 99.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.7H80z" fill="#ECB22E"/>
      <path d="M80 93c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80z" fill="#ECB22E"/>
    </svg>
  );
}

function GTMLogo({ className }: { className?: string }) {
  return (
    <div className={`${className} flex items-center justify-center`}>
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <circle cx="17" cy="7" r="2.5" fill="currentColor"/>
      </svg>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SlackLinkPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SlackLinkContent />
    </Suspense>
  );
}
