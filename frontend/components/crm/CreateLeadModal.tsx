"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { useCreateLead } from "@/hooks/api/useLeads";
import { toast } from "sonner";

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineStageId?: string;
}

export function CreateLeadModal({ isOpen, onClose, pipelineStageId }: CreateLeadModalProps) {
  const createLead = useCreateLead();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    title: "",
    dealValue: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phone) {
      toast.error("Phone number is required");
      return;
    }

    try {
      await createLead.mutateAsync({
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        email: formData.email || undefined,
        phone: formData.phone,
        company: formData.company || undefined,
        title: formData.title || undefined,
        dealValue: formData.dealValue ? parseFloat(formData.dealValue) : undefined,
        pipelineStageId,
      });

      toast.success("Lead created successfully");
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        title: "",
        dealValue: "",
      });
      onClose();
    } catch {
      toast.error("Failed to create lead");
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Lead" subtitle="Add a new lead to your pipeline">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="First Name"
            value={formData.firstName}
            onChange={handleChange("firstName")}
            placeholder="John"
          />
          <FormInput
            label="Last Name"
            value={formData.lastName}
            onChange={handleChange("lastName")}
            placeholder="Doe"
          />
        </div>

        <FormInput
          label="Phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange("phone")}
          placeholder="+1 (555) 123-4567"
          required
        />

        <FormInput
          label="Email"
          type="email"
          value={formData.email}
          onChange={handleChange("email")}
          placeholder="john@example.com"
        />

        <FormInput
          label="Company"
          value={formData.company}
          onChange={handleChange("company")}
          placeholder="Acme Inc."
        />

        <FormInput
          label="Title"
          value={formData.title}
          onChange={handleChange("title")}
          placeholder="VP of Sales"
        />

        <FormInput
          label="Deal Value"
          type="number"
          value={formData.dealValue}
          onChange={handleChange("dealValue")}
          placeholder="10000"
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createLead.isPending}>
            {createLead.isPending ? "Creating..." : "Create Lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
