'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Search } from 'lucide-react';
import { AddToCampaignDropdown } from './AddToCampaignDropdown';
import { AddToPipelineDropdown } from './AddToPipelineDropdown';
import { BulkResearchModal } from '@/components/research';
import { GoogleSheetsExportModal } from '@/components/sheets/GoogleSheetsExportModal';
import { GoogleSheetsIcon } from '@/components/icons/GoogleSheetsIcon';
import { BulkEnrichButton } from '@/components/enrichment/BulkEnrichButton';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClear: () => void;
  onDelete?: () => void;
  onAddToCampaignSuccess?: () => void;
  onAddToPipelineSuccess?: () => void;
  onResearchSuccess?: () => void;
  onExportSuccess?: () => void;
  onEnrichSuccess?: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedIds,
  onClear,
  onDelete,
  onAddToCampaignSuccess,
  onAddToPipelineSuccess,
  onResearchSuccess,
  onExportSuccess: _onExportSuccess,
  onEnrichSuccess,
}: BulkActionBarProps) {
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [showSheetsExport, setShowSheetsExport] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/50 px-4 py-3">
        <span className="text-sm font-medium">
          {selectedCount} lead{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResearchModal(true)}
          >
            <Search className="h-4 w-4 mr-1" />
            Research
          </Button>
          <BulkEnrichButton
            leadIds={selectedIds}
            onComplete={() => {
              onClear();
              onEnrichSuccess?.();
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSheetsExport(true)}
          >
            <GoogleSheetsIcon className="h-4 w-4 mr-1" />
            Export to Sheets
          </Button>
          <AddToCampaignDropdown
            leadIds={selectedIds}
            onSuccess={() => {
              onClear();
              onAddToCampaignSuccess?.();
            }}
          />
          <AddToPipelineDropdown
            leadIds={selectedIds}
            onSuccess={() => {
              onClear();
              onAddToPipelineSuccess?.();
            }}
          />
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <BulkResearchModal
        open={showResearchModal}
        onOpenChange={setShowResearchModal}
        leadIds={selectedIds}
        onSuccess={() => {
          onClear();
          onResearchSuccess?.();
        }}
      />

      <GoogleSheetsExportModal
        isOpen={showSheetsExport}
        onClose={() => setShowSheetsExport(false)}
        dataType="leads"
        leadIds={selectedIds}
      />
    </>
  );
}
