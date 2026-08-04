"use client";
import { useSession } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

// Get the app URL for redirects
const getAppUrl = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.includes("localhost")) {
    return appUrl;
  }
  return "";
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Pages under (auth) that logged-in users should be allowed to stay on
  const allowLoggedIn =
    pathname?.startsWith("/accept-invitation") ||
    pathname?.startsWith("/onboarding") ||
    (pathname?.startsWith("/verify") &&
      typeof window !== "undefined" &&
      window.location.search.includes("inviteId"));

  useEffect(() => {
    // Redirect logged-in users to dashboard unless they're on an allowed page
    if (!isPending && session && !allowLoggedIn) {
      const appUrl = getAppUrl();
      if (appUrl) {
        window.location.href = `${appUrl}/dashboard`;
      } else {
        router.push("/dashboard");
      }
    }
  }, [session, isPending, router, allowLoggedIn]);

  if (isPending) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Only return null if logged in AND being redirected (not on allowed pages)
  if (session && !allowLoggedIn) {
    return null; // Will redirect, so return nothing
  }

  return <>{children}</>;
}
