"use client";

import { useState } from "react";
import { Plus, Trophy, Calendar } from "lucide-react";
import { useActiveOrganization, useSession } from "@/lib/auth-client";
import { useListOrganizationMembers } from "@/hooks/api/useOrganization";
import { useBlitzes, useCreateBlitz, useStartBlitz, useEndBlitz } from "@/hooks/api/useSalesFloor";
import { SalesFloorDashboard } from "@/components/sales-floor/SalesFloorDashboard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Member {
  id: string;
  userId: string;
  role: string;
}

export default function SalesFloorPage() {
  const { data: session } = useSession();
  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;
  const [createBlitzOpen, setCreateBlitzOpen] = useState(false);
  const [blitzName, setBlitzName] = useState("");
  const [blitzGoalType, setBlitzGoalType] = useState<"calls" | "connects" | "meetings">("calls");
  const [blitzGoalTarget, setBlitzGoalTarget] = useState("");
  const [blitzDuration, setBlitzDuration] = useState("30");

  // Get organization members to check user role
  const { data: membersData } = useListOrganizationMembers();
  const members = (membersData?.data?.members || []) as Member[];

  // Check if current user is admin or owner
  const currentUserMember = members.find((m) => m.userId === session?.user?.id);
  const isAdminOrOwner = currentUserMember?.role === "admin" || currentUserMember?.role === "owner";

  const { data: blitzesData } = useBlitzes();
  const createBlitz = useCreateBlitz();
  const startBlitz = useStartBlitz();
  const endBlitz = useEndBlitz();

  const activeBlitz = blitzesData?.data?.find((b) => b.status === "active");
  const scheduledBlitzes = blitzesData?.data?.filter((b) => b.status === "scheduled") || [];

  const handleCreateBlitz = async () => {
    if (!blitzName.trim()) {
      toast.error("Please enter a blitz name");
      return;
    }

    try {
      await createBlitz.mutateAsync({
        name: blitzName,
        durationMinutes: parseInt(blitzDuration),
        goalType: blitzGoalType,
        goalTarget: blitzGoalTarget ? parseInt(blitzGoalTarget) : undefined,
      });
      toast.success("Blitz created successfully");
      setCreateBlitzOpen(false);
      setBlitzName("");
      setBlitzGoalTarget("");
    } catch {
      toast.error("Failed to create blitz");
    }
  };

  const handleStartBlitz = async (blitzId: string) => {
    try {
      await startBlitz.mutateAsync(blitzId);
      toast.success("Blitz started!");
    } catch {
      toast.error("Failed to start blitz");
    }
  };

  const handleEndBlitz = async (blitzId: string) => {
    try {
      await endBlitz.mutateAsync(blitzId);
      toast.success("Blitz ended");
    } catch {
      toast.error("Failed to end blitz");
    }
  };

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">
            Sales Floor
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Real-time visibility into team activity and performance
          </p>
        </div>

        {isAdminOrOwner && (
          <div className="flex items-center gap-2">
            {activeBlitz ? (
              <Button
                variant="destructive"
                onClick={() => handleEndBlitz(activeBlitz.id)}
                disabled={endBlitz.isPending}
              >
                <Trophy className="w-4 h-4 mr-2" />
                End Blitz
              </Button>
            ) : (
              <Dialog open={createBlitzOpen} onOpenChange={setCreateBlitzOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Start Call Blitz
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Call Blitz</DialogTitle>
                    <DialogDescription>
                      Start a team competition to boost activity. Set a goal and duration for the blitz.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="blitz-name">Blitz Name</Label>
                      <Input
                        id="blitz-name"
                        placeholder="e.g., Friday Power Hour"
                        value={blitzName}
                        onChange={(e) => setBlitzName(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="goal-type">Goal Type</Label>
                        <Select value={blitzGoalType} onValueChange={(v: "calls" | "connects" | "meetings") => setBlitzGoalType(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="calls">Total Calls</SelectItem>
                            <SelectItem value="connects">Connections</SelectItem>
                            <SelectItem value="meetings">Meetings Booked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="goal-target">Goal Target (optional)</Label>
                        <Input
                          id="goal-target"
                          type="number"
                          placeholder="e.g., 100"
                          value={blitzGoalTarget}
                          onChange={(e) => setBlitzGoalTarget(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Select value={blitzDuration} onValueChange={setBlitzDuration}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateBlitzOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateBlitz} disabled={createBlitz.isPending}>
                      {createBlitz.isPending ? "Creating..." : "Create & Start"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>

      {/* Scheduled Blitzes */}
      {scheduledBlitzes.length > 0 && isAdminOrOwner && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Scheduled Blitzes
          </h3>
          <div className="space-y-2">
            {scheduledBlitzes.map((blitz) => (
              <div
                key={blitz.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-foreground">{blitz.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {blitz.goalType} goal: {blitz.goalTarget || "No target"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleStartBlitz(blitz.id)}
                  disabled={startBlitz.isPending}
                >
                  Start Now
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <SalesFloorDashboard organizationId={organizationId} />
    </div>
  );
}
