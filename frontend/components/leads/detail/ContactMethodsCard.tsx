'use client'

import { useState } from 'react'
import { Mail, Phone, Plus, Star, Trash2, PhoneOutgoing } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAddContactMethod,
  useContactMethods,
  useDeleteContactMethod,
  useUpdateContactMethod,
} from '@/hooks/api/useContactMethods'
import type { ContactMethodKind } from '@shared/types/src/requests/leadContactMethod'

const LABELS = ['office', 'mobile', 'direct', 'personal', 'assistant', 'other']

interface ContactMethodsCardProps {
  leadId: string
  /** Dial a specific number - omitted when the dialer is unavailable. */
  onCall?: (phoneNumber: string) => void
}

export function ContactMethodsCard({ leadId, onCall }: ContactMethodsCardProps) {
  const { data: methods = [], isLoading } = useContactMethods(leadId)
  const addMethod = useAddContactMethod(leadId)
  const updateMethod = useUpdateContactMethod(leadId)
  const deleteMethod = useDeleteContactMethod(leadId)

  const [isAdding, setIsAdding] = useState(false)
  const [kind, setKind] = useState<ContactMethodKind>('phone')
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('office')

  const phones = methods.filter((method) => method.kind === 'phone')
  const emails = methods.filter((method) => method.kind === 'email')

  const handleAdd = async () => {
    if (!value.trim()) return

    try {
      await addMethod.mutateAsync({ kind, value: value.trim(), label })
      toast.success(kind === 'phone' ? 'Phone number added' : 'Email added')
      setValue('')
      setIsAdding(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add contact method',
      )
    }
  }

  const handlePromote = async (id: string) => {
    try {
      await updateMethod.mutateAsync({ id, isPrimary: true })
      toast.success('Set as primary')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to set primary',
      )
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMethod.mutateAsync(id)
      toast.success('Contact method removed')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove',
      )
    }
  }

  const renderMethod = (method: (typeof methods)[number]) => (
    <div
      key={method.id}
      className="flex items-center gap-2 py-1.5 group"
    >
      {method.kind === 'phone' ? (
        <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      ) : (
        <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      )}

      <span className="text-sm text-foreground truncate">{method.value}</span>

      {method.label && (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
          {method.label}
        </span>
      )}
      {method.isPrimary && (
        <span className="text-[10px] uppercase tracking-wide text-primary flex-shrink-0">
          primary
        </span>
      )}

      <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
        {method.kind === 'phone' && onCall && (
          <button
            onClick={() => onCall(method.value)}
            className="p-1 hover:bg-muted rounded"
            title={`Call ${method.value}`}
          >
            <PhoneOutgoing className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        {!method.isPrimary && (
          <button
            onClick={() => handlePromote(method.id)}
            className="p-1 hover:bg-muted rounded"
            title="Set as primary"
          >
            <Star className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={() => handleDelete(method.id)}
          className="p-1 hover:bg-muted rounded"
          title="Remove"
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground">Contact details</h3>
        {!isAdding && (
          <Button size="sm" variant="ghost" onClick={() => setIsAdding(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : methods.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No contact details yet.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {phones.map(renderMethod)}
          {emails.map(renderMethod)}
        </div>
      )}

      {isAdding && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex gap-2">
            <Select
              value={kind}
              onValueChange={(next) => setKind(next as ContactMethodKind)}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>

            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABELS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {kind === 'phone' ? 'Phone number' : 'Email address'}
            </Label>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={
                kind === 'phone' ? '(555) 123-4567' : 'name@company.com'
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAdd()
              }}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false)
                setValue('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!value.trim() || addMethod.isPending}
            >
              {addMethod.isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
