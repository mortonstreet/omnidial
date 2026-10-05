const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatCurrency = (value: number) =>
  Math.abs(value) >= 100_000 ? usdCompact.format(value) : usd.format(value)

export const formatPercent = (ratio: number, digits = 0) =>
  `${(ratio * 100).toFixed(digits)}%`

export const formatSignedPercent = (pct: number) =>
  `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`

export const formatDays = (days: number) =>
  days < 1 && days > 0 ? '<1d' : `${days.toFixed(days >= 10 ? 0 : 1)}d`

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export const formatScore = (score: number) => `${score.toFixed(1)}/10`

export const formatRelative = (iso: string | null) => {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export const leadHref = (leadId: string) => `/dashboard/crm/leads/${leadId}`
