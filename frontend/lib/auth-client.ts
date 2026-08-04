import { createAuthClient } from "better-auth/react";
import { organizationClient, magicLinkClient } from "better-auth/client/plugins"
import { stripeClient } from "@better-auth/stripe/client"
import { adminClient } from "better-auth/client/plugins"
import { env } from "./config";

const resolveAuthBaseUrl = (apiUrl: string): string => {
  const normalizedApiUrl = apiUrl.replace(/\/+$/, "");
  return normalizedApiUrl.endsWith("/auth")
    ? normalizedApiUrl
    : `${normalizedApiUrl}/auth`;
};

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    stripeClient({
      subscription: true,
    }),
    adminClient(),
    magicLinkClient(),
  ],
  baseURL: resolveAuthBaseUrl(env.API_URL.toString()),
  fetchOptions: {
    credentials: "include",
  }
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  sendVerificationEmail,
  organization,
  useActiveOrganization,
  subscription,
  admin,
} = authClient;
