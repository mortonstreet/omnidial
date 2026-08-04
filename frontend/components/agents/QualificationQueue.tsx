"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Pencil, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  useQualificationsPending,
  useReviewQualification,
  type LeadQualification,
} from "@/hooks/api/useAgents";
import { toast } from "sonner";

const categoryConfig = {
  high_intent: { label: "High Intent", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  medium: { label: "Medium", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  low_intent: { label: "Low Intent", color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  disqualified: { label: "Disqualified", color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export function QualificationQueue() {
  const [page, setPage] = useState(1);
  const [selectedQualification, setSelectedQualification] = useState<LeadQualification | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editedEmail, setEditedEmail] = useState({ subject: "", body: "" });
  const [editedSms, setEditedSms] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const { data, isLoading } = useQualificationsPending({ page, limit: 10 });
  const reviewMutation = useReviewQualification();

  const handleApprove = async (qualification: LeadQualification) => {
    try {
      await reviewMutation.mutateAsync({
        id: qualification.id,
        action: "approve",
      });
      toast.success("Qualification approved");
    } catch {
      toast.error("Failed to approve qualification");
    }
  };

  const handleReject = async (qualification: LeadQualification) => {
    try {
      await reviewMutation.mutateAsync({
        id: qualification.id,
        action: "reject",
      });
      toast.success("Qualification rejected");
    } catch {
      toast.error("Failed to reject qualification");
    }
  };

  const handleEdit = (qualification: LeadQualification) => {
    setSelectedQualification(qualification);
    setEditedEmail({
      subject: qualification.generatedEmail?.subject || "",
      body: qualification.generatedEmail?.body || "",
    });
    setEditedSms(qualification.generatedSms || "");
    setReviewNotes("");
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedQualification) return;

    try {
      await reviewMutation.mutateAsync({
        id: selectedQualification.id,
        action: "edit",
        editedEmail: editedEmail.subject && editedEmail.body ? editedEmail : undefined,
        editedSms: editedSms || undefined,
        reviewNotes: reviewNotes || undefined,
      });
      toast.success("Qualification updated and approved");
      setEditModalOpen(false);
      setSelectedQualification(null);
    } catch {
      toast.error("Failed to update qualification");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>AI-qualified leads awaiting human approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const qualifications = data?.qualifications || [];
  const hasMore = data?.hasMore || false;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Reviews</CardTitle>
              <CardDescription>
                {data?.total || 0} leads awaiting human approval
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {qualifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending qualifications to review
            </div>
          ) : (
            <div className="space-y-4">
              {qualifications.map((q) => (
                <QualificationItem
                  key={q.id}
                  qualification={q}
                  onApprove={() => handleApprove(q)}
                  onReject={() => handleReject(q)}
                  onEdit={() => handleEdit(q)}
                  isLoading={reviewMutation.isPending}
                />
              ))}

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Outreach</DialogTitle>
            <DialogDescription>
              Modify the generated outreach before approving
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedQualification?.generatedEmail && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email-subject">Email Subject</Label>
                  <Input
                    id="email-subject"
                    value={editedEmail.subject}
                    onChange={(e) =>
                      setEditedEmail((prev) => ({ ...prev, subject: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-body">Email Body</Label>
                  <Textarea
                    id="email-body"
                    value={editedEmail.body}
                    onChange={(e) =>
                      setEditedEmail((prev) => ({ ...prev, body: e.target.value }))
                    }
                    rows={6}
                  />
                </div>
              </>
            )}

            {selectedQualification?.generatedSms && (
              <div className="space-y-2">
                <Label htmlFor="sms">SMS Message</Label>
                <Textarea
                  id="sms"
                  value={editedSms}
                  onChange={(e) => setEditedSms(e.target.value)}
                  rows={3}
                  maxLength={320}
                />
                <p className="text-xs text-muted-foreground">
                  {editedSms.length}/320 characters
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Review Notes (optional)</Label>
              <Textarea
                id="notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about your changes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Approve with Edits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function QualificationItem({
  qualification,
  onApprove,
  onReject,
  onEdit,
  isLoading,
}: {
  qualification: LeadQualification;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  isLoading: boolean;
}) {
  const config = categoryConfig[qualification.category];
  const leadName = qualification.lead
    ? [qualification.lead.firstName, qualification.lead.lastName].filter(Boolean).join(" ") || "Unknown"
    : "Unknown";

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{leadName}</span>
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Score: {qualification.score}/100
            </span>
          </div>
          {qualification.lead?.company && (
            <p className="text-sm text-muted-foreground">{qualification.lead.company}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            disabled={isLoading}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={isLoading}
            className="text-red-600 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isLoading}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="text-sm">
        <p className="text-muted-foreground mb-1">AI Reasoning:</p>
        <p className="line-clamp-2">{qualification.reasoning}</p>
      </div>

      {qualification.generatedEmail && (
        <div className="text-sm bg-muted/50 rounded p-2">
          <p className="text-muted-foreground mb-1">Generated Email:</p>
          <p className="font-medium">{qualification.generatedEmail.subject}</p>
          <p className="line-clamp-2 text-muted-foreground">
            {qualification.generatedEmail.body}
          </p>
        </div>
      )}
    </div>
  );
}
