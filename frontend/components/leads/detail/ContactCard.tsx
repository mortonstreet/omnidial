"use client";

import {
  Building2,
  Mail,
  Phone,
  Globe,
  DollarSign,
  PhoneOutgoing,
} from "lucide-react";
import { LinkedInIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeUrl, parseCustomFields } from "./utils";

interface ContactCardProps {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string;
  company: string | null;
  linkedInUrl: string | null;
  website: string | null;
  dealValue: string | null;
  customFields: unknown;
  isEditing: boolean;
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    title: string;
    linkedInUrl: string;
    website: string;
    dealValue: string;
  };
  onFormChange: (data: Partial<ContactCardProps["formData"]>) => void;
  onCall: () => void;
}

export function ContactCard({
  fullName,
  title,
  email,
  phone,
  company,
  linkedInUrl,
  website,
  dealValue,
  customFields,
  isEditing,
  formData,
  onFormChange,
  onCall,
}: ContactCardProps) {
  const customFieldEntries = parseCustomFields(customFields);

  return (
    <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
      {/* Name */}
      <div className="mb-6">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => onFormChange({ firstName: e.target.value })}
                  placeholder="First name"
                  className="h-11 touch-manipulation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => onFormChange({ lastName: e.target.value })}
                  placeholder="Last name"
                  className="h-11 touch-manipulation"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => onFormChange({ title: e.target.value })}
                  placeholder="Job title"
                  className="h-11 touch-manipulation"
                />
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                {fullName}
              </h2>
              {title && (
                <p className="text-sm text-muted-foreground truncate">{title}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* CTA Buttons Row */}
      {!isEditing && (
        <div className="flex flex-wrap gap-2 mb-6">
          {normalizeUrl(linkedInUrl) && (
            <a
              href={normalizeUrl(linkedInUrl)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground transition-all duration-200 hover:text-white hover:border-[#0A66C2] hover:bg-transparent"
              >
                <LinkedInIcon className="w-4 h-4" />
                LinkedIn
              </Button>
            </a>
          )}
          {normalizeUrl(website) && (
            <a
              href={normalizeUrl(website)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground transition-all duration-200 hover:text-white hover:border-white/50 hover:bg-transparent"
              >
                <Globe className="w-4 h-4" />
                Website
              </Button>
            </a>
          )}
          {phone && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCall}
              className="text-muted-foreground transition-all duration-200 hover:text-white hover:border-white/50 hover:bg-transparent"
            >
              <Phone className="w-4 h-4" />
              {phone}
            </Button>
          )}
          {email && (
            <a href={`mailto:${email}`}>
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground transition-all duration-200 hover:text-white hover:border-white/50 hover:bg-transparent"
              >
                <Mail className="w-4 h-4" />
                {email}
              </Button>
            </a>
          )}
        </div>
      )}

      {/* Contact Info (edit mode) */}
      {isEditing && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Contact Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 min-h-[44px]">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                value={formData.phone}
                onChange={(e) => onFormChange({ phone: e.target.value })}
                placeholder="Phone number"
                className="flex-1 h-11 touch-manipulation"
              />
            </div>
            <div className="flex items-center gap-3 min-h-[44px]">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => onFormChange({ email: e.target.value })}
                placeholder="Email address"
                className="flex-1 h-11 touch-manipulation"
              />
            </div>
            <div className="flex items-center gap-3 min-h-[44px]">
              <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                value={formData.company}
                onChange={(e) => onFormChange({ company: e.target.value })}
                placeholder="Company"
                className="flex-1 h-11 touch-manipulation"
              />
            </div>
            <div className="flex items-center gap-3 min-h-[44px]">
              <LinkedInIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="url"
                value={formData.linkedInUrl}
                onChange={(e) => onFormChange({ linkedInUrl: e.target.value })}
                placeholder="LinkedIn URL"
                className="flex-1 h-11 touch-manipulation"
              />
            </div>
            <div className="flex items-center gap-3 min-h-[44px]">
              <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="url"
                value={formData.website}
                onChange={(e) => onFormChange({ website: e.target.value })}
                placeholder="Website URL"
                className="flex-1 h-11 touch-manipulation"
              />
            </div>
            <div className="flex items-center gap-3 min-h-[44px]">
              <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="number"
                value={formData.dealValue}
                onChange={(e) => onFormChange({ dealValue: e.target.value })}
                placeholder="Deal value"
                className="flex-1 h-11 touch-manipulation"
              />
            </div>
          </div>
        </div>
      )}

      {/* Display mode: Company, Deal Value */}
      {!isEditing && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground truncate">
              {company || "No company"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground">
              {dealValue
                ? `$${parseFloat(dealValue).toLocaleString()}`
                : "No deal value"}
            </span>
          </div>
        </div>
      )}

      {/* Custom Fields */}
      {!isEditing && customFieldEntries.length > 0 && (
        <div className="border-t border-border pt-4 mt-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Custom Fields</h3>
          <div className="space-y-2">
            {customFieldEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{key}</span>
                <span className="text-foreground">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile: Quick Actions */}
      {!isEditing && (
        <div className="mt-6 pt-4 border-t border-border sm:hidden">
          <div className="flex gap-3">
            <Button
              className="flex-1 h-12 touch-manipulation"
              onClick={onCall}
            >
              <PhoneOutgoing className="w-5 h-5 mr-2" />
              Call
            </Button>
            {email && (
              <a href={`mailto:${email}`} className="flex-1">
                <Button variant="outline" className="w-full h-12 touch-manipulation">
                  <Mail className="w-5 h-5 mr-2" />
                  Email
                </Button>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
