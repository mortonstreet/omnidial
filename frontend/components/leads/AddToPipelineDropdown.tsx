'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2, GitBranch } from 'lucide-react';
import { usePipelineStages } from '@/hooks/api/usePipeline';
import { useBulkAddToPipeline } from '@/hooks/api/useLeads';
import { toast } from 'sonner';

interface AddToPipelineDropdownProps {
  leadIds: string[];
  onSuccess?: () => void;
}

export function AddToPipelineDropdown({
  leadIds,
  onSuccess,
}: AddToPipelineDropdownProps) {
  const [open, setOpen] = useState(false);
  const { data: stagesData, isLoading: isLoadingStages } = usePipelineStages();
  const bulkAddMutation = useBulkAddToPipeline();

  const handleSelectStage = async (stageId: string, stageName: string) => {
    try {
      const result = await bulkAddMutation.mutateAsync({
        leadIds,
        pipelineStageId: stageId,
      });

      if (result.updated > 0) {
        toast.success(
          `Added ${result.updated} lead${result.updated !== 1 ? 's' : ''} to ${stageName}`
        );
      }
      if (result.alreadyInPipeline > 0) {
        toast.info(
          `${result.alreadyInPipeline} lead${result.alreadyInPipeline !== 1 ? 's were' : ' was'} already in this stage`
        );
      }

      setOpen(false);
      onSuccess?.();
    } catch {
      toast.error('Failed to add leads to pipeline');
    }
  };

  const stages = stagesData?.data ?? [];
  const isPending = bulkAddMutation.isPending;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <GitBranch className="h-4 w-4 mr-1" />
              Add to Pipeline
              <ChevronDown className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Select Pipeline Stage</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoadingStages ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : stages.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No pipeline stages available.
            <br />
            Create stages in CRM settings.
          </div>
        ) : (
          stages.map((stage) => (
            <DropdownMenuItem
              key={stage.id}
              onClick={() => handleSelectStage(stage.id, stage.label)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span>{stage.label}</span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
