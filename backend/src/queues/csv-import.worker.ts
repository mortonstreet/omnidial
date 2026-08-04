import { Worker, Job } from 'bullmq'
import { CsvImportEvent, CsvImportEventType, QueueName } from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as leadService from '@/services/lead.service'
import * as campaignRepo from '@/repositories/campaign.repository'
import { validateAndNormalizePhone } from '@/lib/phone'

interface ParsedLead {
  firstName?: string
  lastName?: string
  email?: string
  phone: string
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
  last_name: 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',
  email: 'email',
  email_address: 'email',
  phone: 'phone',
  phone_number: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  company: 'company',
  company_name: 'company',
  organization: 'company',
  title: 'title',
  job_title: 'title',
  jobtitle: 'title',
  position: 'title',
  linkedin: 'linkedInUrl',
  linkedin_url: 'linkedInUrl',
  linkedinurl: 'linkedInUrl',
  website: 'website',
  website_url: 'website',
  websiteurl: 'website',
  domain: 'website',
  company_website: 'website',
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

  // Validate required field (phone)
  if (!lead.phone) {
    return { error: 'Missing required phone field' }
  }

  // Validate and normalize phone number
  const normalizedPhone = validateAndNormalizePhone(lead.phone)
  if (!normalizedPhone) {
    return { error: `Invalid phone number format: "${lead.phone}"` }
  }

  return {
    lead: {
      ...lead,
      phone: lead.phone,
      normalizedPhone,
    } as ParsedLead,
  }
}

async function processCsvImport(job: Job<CsvImportEvent>) {
  const { organizationId, campaignId, fileContent, fileName } = job.data

  logger.info({ campaignId, fileName }, 'Starting CSV import')

  // Decode base64 content
  const csvContent = Buffer.from(fileContent, 'base64').toString('utf-8')

  // Parse CSV
  const { headers, rows } = parseCSV(csvContent)

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('CSV file is empty or has no data rows')
  }

  logger.info(
    { campaignId, headerCount: headers.length, rowCount: rows.length },
    'CSV parsed',
  )

  // Validate headers - reject imports with unrecognized columns
  const headerValidation = validateHeaders(headers)
  if (!headerValidation.valid) {
    const recognizedHeaders = Object.keys(FIELD_MAPPINGS).join(', ')
    throw new Error(
      `Unrecognized column(s): [${headerValidation.unrecognized.join(', ')}]. ` +
        `Only these columns are allowed: ${recognizedHeaders}. ` +
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
    { campaignId, validLeads: leads.length, errors: errors.length },
    'CSV rows processed',
  )

  if (leads.length === 0) {
    throw new Error('No valid leads found in CSV')
  }

  // Batch create leads
  const BATCH_SIZE = 100
  let totalCreated = 0

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE)

    const result = await leadService.bulkCreate({
      organizationId,
      campaignId,
      leads: batch,
    })

    totalCreated += result.created

    // Update job progress
    const progress = Math.round(((i + batch.length) / leads.length) * 100)
    await job.updateProgress(progress)

    logger.info({ campaignId, progress, totalCreated }, 'CSV import progress')
  }

  // Update campaign counts
  await campaignRepo.updateCounts(campaignId, organizationId)

  logger.info(
    { campaignId, totalCreated, errors: errors.length },
    'CSV import completed',
  )

  return {
    totalRows: rows.length,
    created: totalCreated,
    errors,
  }
}

export class CsvImportProcessor {
  private worker: Worker<CsvImportEvent>

  constructor() {
    this.worker = new Worker<CsvImportEvent>(
      QueueName.CSV_IMPORT,
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
              case CsvImportEventType.PROCESS_CSV:
                return await processCsvImport(job)
              default:
                throw new Error(`Unknown event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            { error, jobId: job.id, campaignId: job.data.campaignId },
            'Failed to process CSV import',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
              campaignId: job.data.campaignId,
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
