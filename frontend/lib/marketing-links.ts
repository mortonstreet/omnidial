export const BOOKING_URL = "https://cal.com/mortonstreetai/intro-call";

/**
 * Sign-in target for marketing pages.
 *
 * Marketing is served from omnidial.io / www.omnidial.io while the app lives on
 * app.omnidial.io. proxy.ts does redirect /login across for us, but linking
 * straight at the app avoids a redirect hop — and avoids depending on the proxy
 * matcher continuing to cover it.
 *
 * Falls back to a relative path when NEXT_PUBLIC_APP_URL is unset or points at
 * localhost, so local development stays on one origin.
 */
export function getSignInUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    return "/login";
  }
  return `${appUrl.replace(/\/$/, "")}/login`;
}
