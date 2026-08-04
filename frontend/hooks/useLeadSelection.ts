import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

interface UseLeadSelectionOptions {
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

export function useLeadSelection(options: UseLeadSelectionOptions = {}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Use ref to avoid dependency on options object
  const onSelectionChangeRef = useRef(options.onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = options.onSelectionChange;
  }, [options.onSelectionChange]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChangeRef.current?.(next);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      onSelectionChangeRef.current?.(next);
      return next;
    });
  }, []);

  const deselectAll = useCallback((ids?: string[]) => {
    if (ids) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        onSelectionChangeRef.current?.(next);
        return next;
      });
    } else {
      setSelectedIds(new Set());
      onSelectionChangeRef.current?.(new Set());
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionChangeRef.current?.(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggleAllOnPage = useCallback(
    (pageIds: string[]) => {
      const allSelected = pageIds.every((id) => selectedIds.has(id));
      if (allSelected) {
        deselectAll(pageIds);
      } else {
        selectAll(pageIds);
      }
    },
    [selectedIds, selectAll, deselectAll]
  );

  const isAllOnPageSelected = useCallback(
    (pageIds: string[]) => {
      if (pageIds.length === 0) return false;
      return pageIds.every((id) => selectedIds.has(id));
    },
    [selectedIds]
  );

  const isSomeOnPageSelected = useCallback(
    (pageIds: string[]) => {
      if (pageIds.length === 0) return false;
      const selectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
      return selectedCount > 0 && selectedCount < pageIds.length;
    },
    [selectedIds]
  );

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds,
    selectedArray,
    selectedCount,
    toggleSelection,
    selectAll,
    deselectAll,
    clearSelection,
    isSelected,
    toggleAllOnPage,
    isAllOnPageSelected,
    isSomeOnPageSelected,
  };
}
