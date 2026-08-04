export type AuthErrorCode =
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_TOKEN_CONSUMED"
  | "AUTH_TOKEN_INVALID"
  | "AUTH_RATE_LIMITED"
  | "AUTH_LOCKED"
  | "AUTH_INVITE_EMAIL_MISMATCH"
  | "AUTH_INVITE_INVALID"
  | "AUTH_CALLBACK_REJECTED"
  | "AUTH_ACTIVE_ORG_INVALID"
  | "AUTH_FAILURE_TRANSIENT";

const LEGACY_ERROR_CODE_MAP: Record<string, AuthErrorCode> = {
  EXPIRED_TOKEN: "AUTH_TOKEN_EXPIRED",
  INVALID_TOKEN: "AUTH_TOKEN_INVALID",
};

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  AUTH_TOKEN_EXPIRED: "This sign-in link has expired. Please request a new one.",
  AUTH_TOKEN_CONSUMED:
    "This sign-in link was already used. Please request a new one.",
  AUTH_TOKEN_INVALID:
    "This sign-in link is invalid. Please request a new one.",
  AUTH_RATE_LIMITED:
    "Too many sign-in attempts. Please wait before requesting another link.",
  AUTH_LOCKED:
    "Too many sign-in attempts. Please wait before requesting another link.",
  AUTH_INVITE_EMAIL_MISMATCH:
    "Please sign in with the invited email address to accept this invitation.",
  AUTH_INVITE_INVALID:
    "This invitation is invalid or expired. Please request a new invitation.",
  AUTH_CALLBACK_REJECTED:
    "An unsafe redirect was blocked and replaced with a safe destination.",
  AUTH_ACTIVE_ORG_INVALID:
    "Your active workspace was invalid and has been reset.",
  AUTH_FAILURE_TRANSIENT:
    "Authentication is temporarily unavailable. Please try again.",
};

export function normalizeAuthErrorCode(
  rawCode: string | null | undefined,
): AuthErrorCode | null {
  if (!rawCode) {
    return null;
  }

  const trimmed = rawCode.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed in AUTH_ERROR_MESSAGES) {
    return trimmed as AuthErrorCode;
  }

  return LEGACY_ERROR_CODE_MAP[trimmed] ?? null;
}

export function getAuthErrorMessage(
  code: AuthErrorCode,
  correlationId?: string | null,
) {
  const base = AUTH_ERROR_MESSAGES[code];
  if (!correlationId) {
    return base;
  }
  return `${base} (Correlation ID: ${correlationId})`;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => {
  if (value && typeof value === "object") {
    return value as UnknownRecord;
  }
  return null;
};

const asString = (value: unknown): string | null => {
  return typeof value === "string" ? value : null;
};

export function extractAuthErrorDetails(error: unknown): {
  code: AuthErrorCode | null;
  correlationId: string | null;
  message: string | null;
} {
  const root = asRecord(error);
  const nestedError = asRecord(root?.error);
  const response = asRecord(root?.response);
  const responseData = asRecord(response?.data);

  const rawCode =
    asString(root?.code) ||
    asString(root?.error) ||
    asString(nestedError?.code) ||
    asString(responseData?.code) ||
    null;

  const correlationId =
    asString(root?.correlationId) ||
    asString(responseData?.correlationId) ||
    null;

  const message =
    asString(root?.message) ||
    asString(nestedError?.message) ||
    asString(responseData?.message) ||
    asString(root?.statusText) ||
    null;

  return {
    code: normalizeAuthErrorCode(rawCode),
    correlationId,
    message,
  };
}
