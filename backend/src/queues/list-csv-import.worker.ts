import { Worker, Job } from 'bullmq'
import {
  ListCsvImportEvent,
  ListCsvImportEventType,
  QueueName,
} from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as leadListService from '@/services/leadList.service'
import * as leadRepo from '@/repositories/lead.repository'
import * as leadListEntryRepo from '@/repositories/leadListEntry.repository'
import * as campaignListRepo from '@/repositories/campaignList.repository'
import * as campaignLeadRepo from '@/repositories/campaign-lead.repository'
import { validateAndNormalizePhone } from '@/lib/phone'

interface ParsedLead {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  normalizedPhone: string | null // E.164 format or null if invalid
  company?: string
  title?: string
  linkedInUrl?: string
  website?: string
}

// CSV field mappings to ParsedLead fields (case-insensitive)
// Note: normalizedPhone is calculated, not mapped from CSV
type CsvMappableField = Exclude<keyof ParsedLead, 'normalizedPhone'>
const FIELD_MAPPINGS: Record<string, CsvMappableField> = {
  first_name: 'firstName',
  firstname: 'firstName',
  'first name': 'firstName',
  first: 'firstName',
  last_name: 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',
  last: 'lastName',
  email: 'email',
  email_address: 'email',
  'email address': 'email',
  'e-mail': 'email',
  phone: 'phone',
  phone_number: 'phone',
  phonenumber: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  mobile_phone: 'phone',
  'mobile phone': 'phone',
  cell: 'phone',
  cell_phone: 'phone',
  'cell phone': 'phone',
  cellphone: 'phone',
  telephone: 'phone',
  tel: 'phone',
  work_phone: 'phone',
  'work phone': 'phone',
  direct_phone: 'phone',
  'direct phone': 'phone',
  'direct dial': 'phone',
  direct: 'phone',
  number: 'phone',
  contact_phone: 'phone',
  'contact phone': 'phone',
  company: 'company',
  company_name: 'company',
  'company name': 'company',
  organization: 'company',
  org: 'company',
  employer: 'company',
  title: 'title',
  job_title: 'title',
  jobtitle: 'title',
  'job title': 'title',
  position: 'title',
  role: 'title',
  linkedin: 'linkedInUrl',
  linkedin_url: 'linkedInUrl',
  linkedinurl: 'linkedInUrl',
  'linkedin url': 'linkedInUrl',
  'linkedin profile': 'linkedInUrl',
  website: 'website',
  website_url: 'website',
  websiteurl: 'website',
  'website url': 'website',
  domain: 'website',
  company_website: 'website',
  'company website': 'website',
  url: 'website',
  site: 'website',
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map(parseCSVLine)

  return { headers, rows }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' && !inQuotes) {
      inQuotes = true
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = false
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

// Validate that all headers are recognized - reject imports with unknown columns
function validateHeaders(headers: string[]): {
  valid: boolean
  unrecognized: string[]
} {
  const unrecognized: string[] = []

  for (const header of headers) {
    const normalized = header.toLowerCase().trim()
    if (!FIELD_MAPPINGS[normalized]) {
      unrecognized.push(header)
    }
  }

  return { valid: unrecognized.length === 0, unrecognized }
}

function mapRowToLead(
  headers: string[],
  row: string[],
):
  | { lead: ParsedLead; error?: undefined }
  | { lead?: undefined; error: string } {
  const lead: Partial<Omit<ParsedLead, 'normalizedPhone'>> & {
    normalizedPhone?: string | null
  } = {}

  for (let i = 0; i < headers.length && i < row.length; i++) {
    const header = headers[i].toLowerCase().trim()
    const value = row[i]?.trim()

    if (!value) continue

    const mappedField = FIELD_MAPPINGS[header]
    if (mappedField) {
      ;(lead as Record<string, string>)[mappedField] = value
    }
    // Unknown columns are now rejected at validation, not stored as custom fields
  }

  // Require at least one identity handle: phone OR LinkedIn URL.
  if (!lead.phone && !lead.linkedInUrl) {
    return { error: 'Missing required phone or LinkedIn URL field' }
  }

  // Validate and normalize phone number only when provided.
  let normalizedPhone: string | null = null
  if (lead.phone) {
    normalizedPhone = validateAndNormalizePhone(lead.phone)
    if (!normalizedPhone) {
      return { error: `Invalid phone number format: "${lead.phone}"` }
    }
  }

  return {
    lead: {
      ...lead,
      phone: lead.phone ?? '',
      normalizedPhone,
    } as ParsedLead,
  }
}

async function processListCsvImport(job: Job<ListCsvImportEvent>) {
  const { organizationId, listId, fileContent, fileName } = job.data

  logger.info({ listId, fileName }, 'Starting list CSV import')

  // Update import status to processing
  await leadListService.updateImportStatus(listId, 'processing')

  try {
    // Decode base64 content
    const csvContent = Buffer.from(fileContent, 'base64').toString('utf-8')

    // Parse CSV
    const { headers, rows } = parseCSV(csvContent)

    if (headers.length === 0 || rows.length === 0) {
      throw new Error('CSV file is empty or has no data rows')
    }

    logger.info(
      { listId, headerCount: headers.length, rowCount: rows.length, headers },
      'CSV parsed',
    )

    // Validate headers - reject imports with unrecognized columns
    const headerValidation = validateHeaders(headers)
    if (!headerValidation.valid) {
      const recognizedHeaders = Object.keys(FIELD_MAPPINGS)
        .slice(0, 20)
        .join(', ')
      throw new Error(
        `Unrecognized column(s): [${headerValidation.unrecognized.join(', ')}]. ` +
          `Only these columns are allowed: ${recognizedHeaders}, etc. ` +
          `Please rename or remove unrecognized columns and try again.`,
      )
    }

    // Map rows to leads
    const leads: ParsedLead[] = []
    const errors: { row: number; error: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const result = mapRowToLead(headers, rows[i])
      if (result.lead) {
        leads.push(result.lead)
      } else {
        errors.push({ row: i + 2, error: result.error })
      }
    }

    logger.info(
      { listId, validLeads: leads.length, errors: errors.length },
      'CSV rows processed',
    )

    if (leads.length === 0) {
      const recognizedPhoneHeaders = Object.keys(FIELD_MAPPINGS).filter(
        (k) => FIELD_MAPPINGS[k] === 'phone',
      )
      throw new Error(
        `No valid leads found - each row must include phone or LinkedIn URL. Found headers: [${headers.join(', ')}]. ` +
          `Recognized phone headers: ${recognizedPhoneHeaders.slice(0, 10).join(', ')}, etc. LinkedIn headers: linkedin, linkedin_url.`,
      )
    }

    // Batch create leads and add to list
    const BATCH_SIZE = 100
    let totalCreated = 0
    const allLeadIds: string[] = []

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE)

      // Create leads in organization using repository
      const createdLeadIds = await leadRepo.bulkCreateIgnoreConflicts(
        organizationId,
        batch.map((lead) => ({
          firstName: lead.firstName ?? null,
          lastName: lead.lastName ?? null,
          email: lead.email ?? null,
          phone: lead.phone ?? '',
          normalizedPhone: lead.normalizedPhone,
          company: lead.company ?? null,
          title: lead.title ?? null,
          linkedInUrl: lead.linkedInUrl ?? null,
          website: lead.website ?? null,
        })),
      )

      allLeadIds.push(...createdLeadIds)
      totalCreated += batch.length

      // Add leads to list
      await leadListEntryRepo.addLeads(listId, createdLeadIds)

      // Update job progress
      const progress = Math.round(((i + batch.length) / leads.length) * 100)
      await job.updateProgress(progress)

      logger.info(
        { listId, progress, totalCreated },
        'List CSV import progress',
      )
    }

    // Update list lead count
    await leadListService.refreshLeadCount(listId)

    // Sync with linked campaigns
    const linkedCampaigns = await campaignListRepo.findByList(listId)
    for (const campaign of linkedCampaigns) {
      const maxOrder = await campaignLeadRepo.getMaxDialOrder(
        campaign.campaignId,
      )
      await campaignLeadRepo.createMany(
        campaign.campaignId,
        allLeadIds,
        maxOrder + 1,
      )
    }

    // Update import status to completed
    await leadListService.updateImportStatus(listId, 'completed')

    logger.info(
      { listId, totalCreated, errors: errors.length },
      'List CSV import completed',
    )

    return {
      totalRows: rows.length,
      created: totalCreated,
      errors,
    }
  } catch (error) {
    // Update import status to failed
    await leadListService.updateImportStatus(
      listId,
      'failed',
      (error as Error).message,
    )
    throw error
  }
}

export class ListCsvImportProcessor {
  private worker: Worker<ListCsvImportEvent>

  constructor() {
    this.worker = new Worker<ListCsvImportEvent>(
      QueueName.LIST_CSV_IMPORT,
      async (job) => {
        setRequestContext('jobId', job.id)
        try {
          return await Sentry.withScope(async (scope) => {
            scope.setContext('job', {
              id: job.id,
              name: job.name,
              data: {
                ...job.data,
                fileContent: '[REDACTED]', // Don't log file content
              },
            })

            switch (job.data.type) {
              case ListCsvImportEventType.PROCESS_CSV:
                return await processListCsvImport(job)
              default:
                throw new Error(`Unknown event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            { error, jobId: job.id, listId: job.data.listId },
            'Failed to process list CSV import',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
              listId: job.data.listId,
            },
          })
          throw error
        }
      },
      {
        connection: {
          url: config.redis.url,
          ...(config.redis.useTLS && {
            tls: {
              rejectUnauthorized: false,
            },
          }),
        },
        concurrency: 2, // Process 2 CSV imports at a time
      },
    )
  }

  async close() {
    await this.worker.close()
  }
}
