export const DEFAULT_AUTH_CALLBACK_PATH = "/dashboard";

const INVITATION_PATH_PATTERN = /^\/accept-invitation\/[a-zA-Z0-9_-]+$/;

const isAbsoluteUrl = (value: string) => /^[a-z][a-z\d+\-.]*:/i.test(value);

export function isAllowedAuthCallbackPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/onboarding") {
    return true;
  }
  return INVITATION_PATH_PATTERN.test(pathname);
}

export function normalizeAuthCallbackPath(
  rawPath: string | null | undefined,
  fallbackPath: string = DEFAULT_AUTH_CALLBACK_PATH,
): { path: string; rejected: boolean } {
  if (!rawPath) {
    return { path: fallbackPath, rejected: false };
  }

  const candidate = rawPath.trim();
  if (!candidate) {
    return { path: fallbackPath, rejected: true };
  }

  if (candidate.startsWith("//") || isAbsoluteUrl(candidate) || !candidate.startsWith("/")) {
    return { path: fallbackPath, rejected: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate, "https://callback.local");
  } catch {
    return { path: fallbackPath, rejected: true };
  }

  if (!isAllowedAuthCallbackPath(parsed.pathname)) {
    return { path: fallbackPath, rejected: true };
  }

  if (parsed.pathname.startsWith("/accept-invitation/")) {
    const email = parsed.searchParams.get("email");
    if (email) {
      return {
        path: `${parsed.pathname}?email=${encodeURIComponent(email)}`,
        rejected: false,
      };
    }
  }

  return { path: parsed.pathname, rejected: false };
}

export function buildInvitationCallbackPath(
  invitationId: string | null | undefined,
  email?: string | null,
): string | null {
  if (!invitationId) {
    return null;
  }
  const path = `/accept-invitation/${invitationId}`;
  if (!INVITATION_PATH_PATTERN.test(path)) {
    return null;
  }
  if (email) {
    return `${path}?email=${encodeURIComponent(email)}`;
  }
  return path;
}

export function buildAuthFlowCallbackPath(params: {
  redirectPath?: string | null;
  invitationId?: string | null;
  invitationEmail?: string | null;
  fallbackPath: string;
}): string {
  const normalizedRedirect = normalizeAuthCallbackPath(
    params.redirectPath,
    params.fallbackPath,
  );
  if (params.redirectPath) {
    return normalizedRedirect.path;
  }

  const invitationPath = buildInvitationCallbackPath(
    params.invitationId,
    params.invitationEmail,
  );
  if (invitationPath) {
    return invitationPath;
  }

  return params.fallbackPath;
}

