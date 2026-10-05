'use client'

import { useState } from 'react'
import {
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  PenLine,
  Phone,
  Trophy,
  Users,
  Video,
  XCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useLeadDealSignals, useRecordManualSignal } from '@/hooks/api/useDealMetrics'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { DealOutcomeDialog } from './DealOutcomeDialog'
import {
  DEAL_LOSS_REASONS,
  DEAL_WIN_REASONS,
  type DealOutcome,
  type DealSignal,
} from '@shared/types/src/requests/dealMetrics'

interface LeadDealSignalsProps {
  leadId: string
  leadName: string
  dealOutcome?: DealOutcome | null
  dealOutcomeReason?: string | null
  dealOutcomeNotes?: string | null
  /** Set when the lead was just dropped into a won/lost stage. */
  pendingOutcome?: DealOutcome | null
  onPendingOutcomeHandled?: () => void
}

const SOURCE_ICON = { call: Phone, email: Mail, meeting: Video, manual: PenLine } as const

const reasonLabel = (outcome: DealOutcome, reason: string) =>
  (outcome === 'won' ? DEAL_WIN_REASONS : DEAL_LOSS_REASONS).find(
    (r) => r.value === reason,
  )?.label ?? reason

const scoreTone = (score: number | null) =>
  score === null
    ? 'text-muted-foreground'
    : score >= 7
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 4
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-semibold ${scoreTone(value)}`}>
        {value ?? '–'}
        <span className="text-xs text-muted-foreground font-normal">/10</span>
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function SignalRow({ signal }: { signal: DealSignal }) {
  const Icon = SOURCE_ICON[signal.source as keyof typeof SOURCE_ICON] ?? Phone
  return (
    <li className="flex gap-3 py-2 border-b border-border last:border-0">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{signal.source}</span>
          <span>·</span>
          <span>
            {formatDistanceToNow(new Date(signal.occurredAt), { addSuffix: true })}
          </span>
          {signal.nextStepSecured && (
            <span className="text-emerald-600 dark:text-emerald-400">· next step secured</span>
          )}
          {signal.sourceUrl && (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto hover:text-foreground"
              aria-label="Open source"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {signal.summary && <p className="text-sm text-foreground">{signal.summary}</p>}
        {signal.nextStep && (
          <p className="text-xs text-muted-foreground">
            Next step: <span className="text-foreground">{signal.nextStep}</span>
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Deal health for one lead: outcome + reason, the latest AI-scored next step
 * and champion, and every scored touchpoint (calls, emails, meetings).
 */
export function LeadDealSignals({
  leadId,
  leadName,
  dealOutcome,
  dealOutcomeReason,
  dealOutcomeNotes,
  pendingOutcome,
  onPendingOutcomeHandled,
}: LeadDealSignalsProps) {
  const { data, isLoading } = useLeadDealSignals(leadId)
  const [dialogOutcome, setDialogOutcome] = useState<DealOutcome | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)

  const signals = data?.data ?? []
  const latest = signals[0]
  const openOutcome = pendingOutcome ?? dialogOutcome

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">Deal health</h2>
          {dealOutcome && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                dealOutcome === 'won'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400'
              }`}
            >
              {dealOutcome === 'won' ? 'Won' : 'Lost'}
              {dealOutcomeReason ? ` · ${reasonLabel(dealOutcome, dealOutcomeReason)}` : ''}
            </span>
          )}
          {dealOutcome && !dealOutcomeReason && (
            <span className="text-xs text-amber-600 dark:text-amber-400">reason missing</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOutcome('won')}>
            <Trophy className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
            {dealOutcome === 'won' ? 'Edit win reason' : 'Mark won'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialogOutcome('lost')}>
            <XCircle className="w-3.5 h-3.5 mr-1.5 text-red-500" />
            {dealOutcome === 'lost' ? 'Edit loss reason' : 'Mark lost'}
          </Button>
        </div>
      </div>

      {editing ? (
        <ManualContextForm leadId={leadId} onDone={() => setEditing(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <PenLine className="w-3.5 h-3.5" />
          Add context: next step or champion
        </button>
      )}

      {dealOutcomeNotes && (
        <p className="text-sm text-muted-foreground italic">“{dealOutcomeNotes}”</p>
      )}

      {isLoading ? (
        <div className="h-16 rounded-lg bg-muted animate-pulse" />
      ) : !latest ? (
        <p className="text-sm text-muted-foreground">
          No scored touchpoints yet. Calls are scored once they have a transcript
          (run Call Intelligence on a call); connect Gmail or Grain in
          Integrations to score emails and meetings.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Score label="Next step" value={latest.nextStepScore} />
            <Score label="Champion" value={latest.championScore} />
            <Score label="Engagement" value={latest.engagementScore} />
            <Score label="Rep execution" value={latest.qualityScore} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div className="flex gap-2">
              <CalendarCheck
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  latest.nextStepSecured ? 'text-emerald-500' : 'text-muted-foreground'
                }`}
              />
              <span className="text-foreground">
                {latest.nextStep ?? 'No next step agreed on the last touchpoint'}
                {latest.nextStepDueAt && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {new Date(latest.nextStepDueAt).toLocaleString()}
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <Users className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <span className="text-foreground">
                {latest.championName
                  ? `Champion: ${latest.championName}`
                  : 'No champion identified yet'}
              </span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {signals.length} scored touchpoint{signals.length === 1 ? '' : 's'}
            </button>
            {expanded && (
              <ul className="mt-2">
                {signals.map((signal) => (
                  <SignalRow key={signal.id} signal={signal} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {openOutcome && (
        <DealOutcomeDialog
          open
          onOpenChange={(open) => {
            if (open) return
            setDialogOutcome(null)
            onPendingOutcomeHandled?.()
          }}
          leadId={leadId}
          leadName={leadName}
          outcome={openOutcome}
        />
      )}
    </div>
  )
}

/**
 * Fill in what the AI could not see: the agreed next step (a date makes it
 * "secured") and who is championing the deal.
 */
function ManualContextForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const record = useRecordManualSignal()
  const [nextStep, setNextStep] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [championName, setChampionName] = useState('')
  const [championScore, setChampionScore] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nextStep.trim() && !championName.trim()) return
    try {
      await record.mutateAsync({
        leadId,
        nextStep: nextStep.trim() || null,
        nextStepDueAt: dueAt ? new Date(dueAt).toISOString() : null,
        championName: championName.trim() || null,
        championScore: championScore === '' ? null : Number(championScore),
      })
      toast.success('Context saved')
      onDone()
    } catch (error) {
      toast.error('Could not save', { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2 rounded-lg border border-border p-3">
      <Input
        placeholder="Next step (e.g. Demo with their CFO)"
        value={nextStep}
        onChange={(e) => setNextStep(e.target.value)}
        maxLength={500}
      />
      <Input
        type="datetime-local"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        aria-label="Next step date"
        title="A dated next step counts as secured"
      />
      <Input
        placeholder="Champion name"
        value={championName}
        onChange={(e) => setChampionName(e.target.value)}
        maxLength={200}
      />
      <select
        value={championScore}
        onChange={(e) => setChampionScore(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        aria-label="Champion strength"
      >
        <option value="">Champion strength</option>
        {[10, 8, 6, 4, 2, 0].map((n) => (
          <option key={n} value={n}>
            {n}/10{n >= 8 ? ' (actively selling for us)' : n <= 2 ? ' (no advocate)' : ''}
          </option>
        ))}
      </select>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={record.isPending || (!nextStep.trim() && !championName.trim())}>
          {record.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
