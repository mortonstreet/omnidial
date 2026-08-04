'use client';

import { useState } from 'react';
import Modal from '@/components/ui/modal';
import { FormInput } from '@/components/ui/form-input';
import { Button } from '@/components/ui/button';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: 'member' | 'owner') => void;
  isLoading: boolean;
}

export function InviteMemberModal({
  isOpen,
  onClose,
  onInvite,
  isLoading,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'owner'>('member');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onInvite(email, role);
      setEmail('');
      setRole('member');
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Invite Team Member"
      subtitle="Send an invitation to join your organization"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Email Address"
          type="email"
          placeholder="colleague@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Role
          </label>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition">
              <input
                type="radio"
                name="role"
                value="member"
                checked={role === 'member'}
                onChange={() => setRole('member')}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-foreground">Member</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Full app access: dialer, CRM, campaigns, leads, analytics
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition">
              <input
                type="radio"
                name="role"
                value="owner"
                checked={role === 'owner'}
                onChange={() => setRole('owner')}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-foreground">Owner</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Full admin access: billing, team management, Twilio config, integrations
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !email}>
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
