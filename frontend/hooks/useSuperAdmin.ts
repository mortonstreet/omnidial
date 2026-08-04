import { useSession } from "@/lib/auth-client";

export function useSuperAdmin(): boolean {
  const { data: session } = useSession();
  return (session?.user as Record<string, unknown>)?.role === "superadmin";
}
