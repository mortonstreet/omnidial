'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import type { DataVendorProvider } from '@shared/types/src'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BrandLogo } from '@/components/ui/BrandLogo'
import {
  useEnrichLead,
  useEnrichmentVendors,
  useLeadContactInfo,
} from '@/hooks/api/useEnrichment'
import {
  ContactEnrichmentField,
  getActiveContactEnrichmentVendors,
  getDefaultContactEnrichmentFields,
  getEnrichmentProviderLabel,
  hasUsableEmail,
  hasUsablePhone,
} from '@/lib/enrichment-ui'
import { toast } from 'sonner'

interface EnrichButtonProps {
  leadId: string
  enrichmentStatus?: string | null
  email?: string | null
  phone?: string | null
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'icon'
  onComplete?: () => void
}

const FIELD_LABELS: Record<ContactEnrichmentField, string> = {
  phone: 'Phone number',
  email: 'Email',
}

export function EnrichButton({
  leadId,
  email,
  phone,
  variant = 'outline',
  size = 'default',
  onComplete,
}: EnrichButtonProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<DataVendorProvider | null>(null)
  const [selectedFields, setSelectedFields] = useState<
    ContactEnrichmentField[]
  >([])

  const enrichLead = useEnrichLead()
  const { data: vendorsData, isLoading: vendorsLoading } =
    useEnrichmentVendors()
  const { data: contactsData } = useLeadContactInfo(leadId)

  const activeVendors = useMemo(
    () => getActiveContactEnrichmentVendors(vendorsData?.data),
    [vendorsData?.data],
  )

  const hasPhone = useMemo(
    () =>
      hasUsablePhone(phone) ||
      (contactsData?.contacts ?? []).some(
        (contact) =>
          ['mobile', 'direct_dial', 'office'].includes(contact.type) &&
          hasUsablePhone(contact.value),
      ),
    [contactsData?.contacts, phone],
  )

  const hasEmail = useMemo(
    () =>
      hasUsableEmail(email) ||
      (contactsData?.contacts ?? []).some(
        (contact) =>
          ['work_email', 'personal_email'].includes(contact.type) &&
          hasUsableEmail(contact.value),
      ),
    [contactsData?.contacts, email],
  )

  const hasMissingContactField = !hasPhone || !hasEmail

  const openProviderDialog = (provider: DataVendorProvider) => {
    if (!hasMissingContactField) return
    setSelectedProvider(provider)
    setSelectedFields(getDefaultContactEnrichmentFields({ hasPhone, hasEmail }))
  }

  const toggleField = (field: ContactEnrichmentField, checked: boolean) => {
    setSelectedFields((prev) =>
      checked
        ? Array.from(new Set([...prev, field]))
        : prev.filter((f) => f !== field),
    )
  }

  const handleEnrich = async () => {
    if (!selectedProvider || selectedFields.length === 0) return

    try {
      const result = await enrichLead.mutateAsync({
        leadId,
        providers: [selectedProvider],
        dataTypes: selectedFields,
      })

      if (result.success && result.fieldsEnriched.length > 0) {
        toast.success(
          `${getEnrichmentProviderLabel(selectedProvider)} enriched ${result.fieldsEnriched.length} field${
            result.fieldsEnriched.length === 1 ? '' : 's'
          } (${result.creditsUsed} credits)`,
        )
      } else if (result.success && result.creditsUsed === 0) {
        toast.info('Skipped enrichment; requested contact data already exists.')
      } else {
        toast.error(result.errorMessage || 'Enrichment failed')
      }

      setSelectedProvider(null)
      onComplete?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to enrich lead',
      )
    }
  }

  if (vendorsLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
        {size === 'icon' ? null : 'Loading'}
      </Button>
    )
  }

  if (activeVendors.length === 0) {
    return null
  }

  const firstVendor = activeVendors[0]
  const providerLabel = getEnrichmentProviderLabel(firstVendor.provider)
  const buttonContent =
    activeVendors.length === 1 ? (
      <>
        <BrandLogo provider={firstVendor.provider} size={16} />
        {size === 'icon' ? null : providerLabel}
      </>
    ) : (
      <>
        <Sparkles className="w-4 h-4" />
        {size === 'icon' ? null : 'Enrich'}
        {size === 'icon' ? null : <ChevronDown className="w-4 h-4" />}
      </>
    )

  return (
    <>
      {activeVendors.length === 1 ? (
        <Button
          variant={variant}
          size={size}
          onClick={() => openProviderDialog(firstVendor.provider)}
          disabled={enrichLead.isPending || !hasMissingContactField}
          className={size === 'icon' ? 'h-10 w-10' : undefined}
          aria-label={`${providerLabel} enrichment`}
          title={
            hasMissingContactField
              ? `${providerLabel} enrichment`
              : 'Phone and email already added'
          }
        >
          {enrichLead.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            buttonContent
          )}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size={size}
              disabled={enrichLead.isPending || !hasMissingContactField}
              className={size === 'icon' ? 'h-10 w-10' : undefined}
              aria-label="Enrichment providers"
              title={
                hasMissingContactField
                  ? 'Enrichment providers'
                  : 'Phone and email already added'
              }
            >
              {enrichLead.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                buttonContent
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {activeVendors.map((vendor) => (
              <DropdownMenuItem
                key={vendor.id}
                onClick={() => openProviderDialog(vendor.provider)}
              >
                <span className="mr-2 flex h-4 w-4 items-center justify-center">
                  <BrandLogo provider={vendor.provider} size={16} />
                </span>
                {getEnrichmentProviderLabel(vendor.provider)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog
        open={!!selectedProvider}
        onOpenChange={(open) => {
          if (!open) setSelectedProvider(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProvider && (
                <BrandLogo provider={selectedProvider} size={20} />
              )}
              {selectedProvider
                ? getEnrichmentProviderLabel(selectedProvider)
                : 'Enrichment'}
            </DialogTitle>
            <DialogDescription>
              Choose which missing contact fields to enrich.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(['phone', 'email'] as ContactEnrichmentField[]).map((field) => {
              const alreadyPresent = field === 'phone' ? hasPhone : hasEmail
              return (
                <label
                  key={field}
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                >
                  <Checkbox
                    checked={selectedFields.includes(field)}
                    disabled={alreadyPresent}
                    onCheckedChange={(checked) =>
                      toggleField(field, checked === true)
                    }
                  />
                  <span className="text-sm font-medium">
                    {FIELD_LABELS[field]}
                  </span>
                  {alreadyPresent && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Already added
                    </span>
                  )}
                </label>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProvider(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEnrich}
              disabled={enrichLead.isPending || selectedFields.length === 0}
            >
              {enrichLead.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Run enrichment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
