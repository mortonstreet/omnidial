'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Search } from 'lucide-react';
import { useSmartQuery } from '@/hooks/api/useLeads';
import { useDebounce } from '@/hooks/useDebounce';

interface SmartQueryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: Record<string, unknown>, humanReadable: string) => void;
}

export function SmartQueryModal({
  open,
  onOpenChange,
  onApply,
}: SmartQueryModalProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);
  const smartQueryMutation = useSmartQuery();

  // Auto-preview when query changes
  useEffect(() => {
    if (debouncedQuery.trim().length > 2) {
      smartQueryMutation.mutate({ query: debouncedQuery, previewOnly: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const handleApply = () => {
    if (smartQueryMutation.data) {
      onApply(
        smartQueryMutation.data.interpretation.filters,
        smartQueryMutation.data.interpretation.humanReadable
      );
      onOpenChange(false);
      setQuery('');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Smart Query
          </DialogTitle>
          <DialogDescription>
            Describe the leads you&apos;re looking for in natural language
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Textarea
              placeholder="e.g., VPs and Directors at tech companies in California"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-20"
            />
          </div>

          {smartQueryMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing query...
            </div>
          )}

          {smartQueryMutation.data && !smartQueryMutation.isPending && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Interpreted as:
                </p>
                <p className="text-sm font-mono">
                  {smartQueryMutation.data.interpretation.humanReadable}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>
                  <strong>{smartQueryMutation.data.previewCount}</strong> leads
                  match this query
                </span>
              </div>
            </div>
          )}

          {smartQueryMutation.isError && (
            <div className="text-sm text-destructive">
              Failed to parse query. Try a different phrasing.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={
              !smartQueryMutation.data ||
              smartQueryMutation.isPending ||
              smartQueryMutation.data.previewCount === 0
            }
          >
            Apply Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
