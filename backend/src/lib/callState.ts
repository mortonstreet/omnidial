const CALL_PROGRESS_ORDER: Record<string, number> = {
  initiated: 1,
  ringing: 2,
  'in-progress': 3,
}

const CALL_TERMINAL_PRIORITY: Record<string, number> = {
  missed: 1,
  failed: 2,
  completed: 3,
}

export const isCallTerminalStatus = (status?: string | null): boolean =>
  !!status && CALL_TERMINAL_PRIORITY[status] !== undefined

/**
 * Returns the resolved next status when transition is allowed.
 * Returns null when the incoming status must be ignored to prevent state
 * regression from out-of-order or replayed webhook events.
 */
export const resolveCallStatusTransition = (
  currentStatus?: string | null,
  nextStatus?: string | null,
): string | null => {
  if (!nextStatus) {
    return null
  }

  if (!currentStatus || currentStatus === nextStatus) {
    return nextStatus
  }

  const currentIsTerminal = isCallTerminalStatus(currentStatus)
  const nextIsTerminal = isCallTerminalStatus(nextStatus)

  if (currentIsTerminal) {
    if (!nextIsTerminal) {
      return null
    }

    const currentPriority = CALL_TERMINAL_PRIORITY[currentStatus] ?? 0
    const nextPriority = CALL_TERMINAL_PRIORITY[nextStatus] ?? 0
    return nextPriority >= currentPriority ? nextStatus : null
  }

  if (nextIsTerminal) {
    return nextStatus
  }

  const currentProgress = CALL_PROGRESS_ORDER[currentStatus]
  const nextProgress = CALL_PROGRESS_ORDER[nextStatus]

  if (currentProgress !== undefined && nextProgress !== undefined) {
    return nextProgress >= currentProgress ? nextStatus : null
  }

  return nextStatus
}
