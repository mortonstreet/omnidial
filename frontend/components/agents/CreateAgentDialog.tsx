"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2 } from "lucide-react";
import { useCreateAgent, type Agent } from "@/hooks/api/useAgents";
import { toast } from "sonner";

interface CreateAgentDialogProps {
  onSuccess?: (agent: Agent) => void;
}

export function CreateAgentDialog({ onSuccess }: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    emailEnabled: false,
    smsEnabled: false,
    dailyEmailLimit: 100,
    dailySmsLimit: 50,
  });

  const createAgent = useCreateAgent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter an agent name");
      return;
    }

    if (!formData.systemPrompt.trim()) {
      toast.error("Please enter a system prompt");
      return;
    }

    try {
      const agent = await createAgent.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        systemPrompt: formData.systemPrompt.trim(),
        emailEnabled: formData.emailEnabled,
        smsEnabled: formData.smsEnabled,
        dailyEmailLimit: formData.dailyEmailLimit,
        dailySmsLimit: formData.dailySmsLimit,
      });

      toast.success("Agent created successfully");
      setOpen(false);
      resetForm();
      onSuccess?.(agent);
    } catch {
      toast.error("Failed to create agent");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      systemPrompt: "",
      emailEnabled: false,
      smsEnabled: false,
      dailyEmailLimit: 100,
      dailySmsLimit: 50,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create AI Agent</DialogTitle>
            <DialogDescription>
              Configure a new AI SDR agent to qualify leads and generate outreach
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="e.g., Enterprise SDR"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Brief description of the agent's purpose"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                placeholder="Enter the system prompt that defines the agent's behavior and personality..."
                value={formData.systemPrompt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))
                }
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                This prompt defines how the agent qualifies leads and generates outreach
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Email Outreach</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable email generation
                  </p>
                </div>
                <Switch
                  checked={formData.emailEnabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, emailEnabled: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>SMS Outreach</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable SMS generation
                  </p>
                </div>
                <Switch
                  checked={formData.smsEnabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, smsEnabled: checked }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emailLimit">Daily Email Limit</Label>
                <Input
                  id="emailLimit"
                  type="number"
                  min={1}
                  max={1000}
                  value={formData.dailyEmailLimit}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      dailyEmailLimit: parseInt(e.target.value) || 100,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smsLimit">Daily SMS Limit</Label>
                <Input
                  id="smsLimit"
                  type="number"
                  min={1}
                  max={500}
                  value={formData.dailySmsLimit}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      dailySmsLimit: parseInt(e.target.value) || 50,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createAgent.isPending}>
              {createAgent.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
