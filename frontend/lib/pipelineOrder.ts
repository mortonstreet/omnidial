/**
 * Pure ordering helpers for the pipeline board.
 *
 * Kept out of the component so the drag/persist decisions can be reasoned
 * about (and tested) without a DOM: the board's column order is whatever
 * these produce, and the server stores it as a positional sortOrder.
 */

export interface StageSortOrder {
  id: string
  sortOrder: number
}

/** Board order: ascending sortOrder, without mutating the caller's array. */
export const sortByOrder = <T extends { sortOrder: number }>(stages: T[]): T[] =>
  [...stages].sort((a, b) => a.sortOrder - b.sortOrder)

/**
 * Move the dragged stage into the target's slot, shifting the rest along.
 * Returns the original array when the move is a no-op so React can skip the
 * re-render.
 */
export const moveStage = <T extends { id: string }>(
  stages: T[],
  draggedId: string,
  targetId: string,
): T[] => {
  const draggedIndex = stages.findIndex((stage) => stage.id === draggedId)
  const targetIndex = stages.findIndex((stage) => stage.id === targetId)

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return stages
  }

  const reordered = [...stages]
  const [moved] = reordered.splice(draggedIndex, 1)
  reordered.splice(targetIndex, 0, moved)

  return reordered
}

/**
 * Position becomes the persisted sortOrder, so the order the user sees is the
 * order that survives a refresh.
 */
export const toSortOrderPayload = (
  stages: { id: string }[],
): StageSortOrder[] =>
  stages.map((stage, index) => ({ id: stage.id, sortOrder: index }))
