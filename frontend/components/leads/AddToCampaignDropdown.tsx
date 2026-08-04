'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Plus, Loader2 } from 'lucide-react';
import { useCampaigns, useCreateCampaign } from '@/hooks/api/useCampaigns';
import { useBulkAddToCampaign } from '@/hooks/api/useLeads';
import { toast } from 'sonner';

interface AddToCampaignDropdownProps {
  leadIds: string[];
  onSuccess?: () => void;
}

export function AddToCampaignDropdown({
  leadIds,
  onSuccess,
}: AddToCampaignDropdownProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const { data: campaignsData, isLoading: isLoadingCampaigns } = useCampaigns({
    limit: 50,
  });
  const bulkAddMutation = useBulkAddToCampaign();
  const createCampaignMutation = useCreateCampaign();

  const handleSelectCampaign = async (campaignId: string, campaignName: string) => {
    try {
      const result = await bulkAddMutation.mutateAsync({
        leadIds,
        campaignId,
      });

      if (result.added > 0) {
        toast.success(
          `Added ${result.added} lead${result.added !== 1 ? 's' : ''} to ${campaignName}`
        );
      }
      if (result.alreadyInCampaign > 0) {
        toast.info(
          `${result.alreadyInCampaign} lead${result.alreadyInCampaign !== 1 ? 's were' : ' was'} already in the campaign`
        );
      }

      setOpen(false);
      onSuccess?.();
    } catch {
      toast.error('Failed to add leads to campaign');
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newCampaignName.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    try {
      const campaign = await createCampaignMutation.mutateAsync({
        name: newCampaignName.trim(),
      });

      const result = await bulkAddMutation.mutateAsync({
        leadIds,
        campaignId: campaign.id,
      });

      toast.success(
        `Created "${campaign.name}" and added ${result.added} lead${result.added !== 1 ? 's' : ''}`
      );

      setOpen(false);
      setIsCreating(false);
      setNewCampaignName('');
      onSuccess?.();
    } catch {
      toast.error('Failed to create campaign');
    }
  };

  const campaigns = campaignsData?.data ?? [];
  const isPending = bulkAddMutation.isPending || createCampaignMutation.isPending;

  return (
    <DropdownMenu open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        setIsCreating(false);
        setNewCampaignName('');
      }
    }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Add to Campaign
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isCreating ? (
          <div className="p-2 space-y-2">
            <Input
              placeholder="Campaign name"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateAndAdd();
                }
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewCampaignName('');
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsCreating(false);
                  setNewCampaignName('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleCreateAndAdd}
                disabled={isPending || !newCampaignName.trim()}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DropdownMenuLabel>Select Campaign</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isLoadingCampaigns ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No campaigns available
              </div>
            ) : (
              campaigns.map((campaign) => (
                <DropdownMenuItem
                  key={campaign.id}
                  onClick={() => handleSelectCampaign(campaign.id, campaign.name)}
                >
                  <div className="flex flex-col">
                    <span>{campaign.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {campaign.leadCount} leads
                    </span>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" />
              Create New Campaign
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
