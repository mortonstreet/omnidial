'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * Copy text to the clipboard with transient "copied" feedback.
 *
 * Emails are copied rather than opened in a mail client - they almost always
 * get pasted into an existing thread somewhere else.
 */
export function useCopyToClipboard(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(
    async (text: string, label = 'Copied to clipboard') => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopied(false), resetAfterMs)
        toast.success(label, { description: text })
        return true
      } catch {
        toast.error('Failed to copy', { description: text })
        return false
      }
    },
    [resetAfterMs],
  )

  return { copy, copied }
}
