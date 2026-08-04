"use client";

import Card from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

export function AccountSettings() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="space-y-6">
      <Card title="Profile">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Name
              </label>
              <p className="text-foreground">{user?.name || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <p className="text-foreground">{user?.email || "N/A"}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
