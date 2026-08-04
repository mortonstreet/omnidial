import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Environment-based configuration
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL || "http://localhost:3000";
const _ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";

// Pages that should only be on the app subdomain
const APP_ROUTES = ["/dashboard", "/login", "/signup", "/verify", "/reset-password", "/accept-invitation"];

// Pages that should only be on the marketing site
const MARKETING_ROUTES = ["/"];

// Pages on the enrich subdomain
const ENRICH_ROUTES = ["/", "/upload", "/leads", "/push", "/settings", "/login", "/signup"];

function getHostType(host: string): "app" | "enrich" | "marketing" | "local" {
  // Local development - treat as unified
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return "local";
  }

  // App subdomain
  if (host.startsWith("app.")) {
    return "app";
  }

  // Enrich subdomain
  if (host.startsWith("enrich.")) {
    return "enrich";
  }

  // Marketing site (root domain or www)
  return "marketing";
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get("host") || "";
  const pathname = url.pathname;
  const hostType = getHostType(host);

  // In local development, don't redirect between subdomains
  if (hostType === "local") {
    return NextResponse.next();
  }

  // Check if the path matches app routes
  const isAppRoute = APP_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));

  // Check if the path is the landing page (marketing only)
  const _isMarketingRoute = pathname === "/" || MARKETING_ROUTES.some((route) => pathname.startsWith(route + "/") && route !== "/");

  // On enrich subdomain, allow enrich routes and auth routes through
  if (hostType === "enrich") {
    const isEnrichRoute = ENRICH_ROUTES.some(
      (route) => pathname === route || (route !== "/" && pathname.startsWith(route + "/"))
    );
    // Allow enrich routes and auth routes through
    if (isEnrichRoute) {
      return NextResponse.next();
    }
    // Redirect unknown routes to enrich landing page
    return NextResponse.redirect(new URL("/", request.url));
  }

  // On marketing site, redirect app routes to app subdomain
  if (hostType === "marketing" && isAppRoute) {
    const appUrl = new URL(pathname, APP_URL);
    appUrl.search = url.search;
    return NextResponse.redirect(appUrl);
  }

  // On app subdomain, redirect landing page to marketing site.
  // Only redirect real browser navigations – fetch / prefetch / RSC requests
  // must stay same-origin, otherwise the browser blocks the 307 on CORS.
  if (hostType === "app" && pathname === "/") {
    const isNavigation = request.headers.get("sec-fetch-mode") === "navigate";
    if (isNavigation) {
      const marketingUrl = new URL("/", MARKETING_URL);
      return NextResponse.redirect(marketingUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api routes
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
