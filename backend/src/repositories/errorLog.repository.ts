import { db } from '@/lib/db'
import { sql } from 'kysely'
import { withId } from './utils'
import type { CreateErrorLogInput } from '@shared/types/src'

export interface GetErrorLogsFilters {
  page: number
  limit: number
  severity?: string
  product?: string
  category?: string
  status?: string
  organizationId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export interface GetErrorLogStatsParams {
  startDate: string
  endDate: string
  groupBy: 'hour' | 'day' | 'week'
  organizationId?: string
}

export const create = async (data: CreateErrorLogInput) => {
  return db
    .insertInto('error_log')
    .values(
      withId({
        ...data,
        metadata: JSON.stringify(data.metadata ?? {}),
        occurredAt: new Date(),
        createdAt: new Date(),
        status: 'open',
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findWithPagination = async (filters: GetErrorLogsFilters) => {
  let query = db
    .selectFrom('error_log')
    .selectAll('error_log')
    .orderBy('occurredAt', 'desc')

  // Apply filters
  if (filters.severity) {
    query = query.where('severity', '=', filters.severity)
  }
  if (filters.product) {
    query = query.where('product', '=', filters.product)
  }
  if (filters.category) {
    query = query.where('category', '=', filters.category)
  }
  if (filters.status) {
    query = query.where('status', '=', filters.status)
  }
  if (filters.organizationId) {
    query = query.where('organizationId', '=', filters.organizationId)
  }
  if (filters.startDate) {
    query = query.where('occurredAt', '>=', new Date(filters.startDate))
  }
  if (filters.endDate) {
    query = query.where('occurredAt', '<=', new Date(filters.endDate))
  }
  if (filters.search) {
    const searchPattern = `%${filters.search}%`
    query = query.where((eb) =>
      eb.or([
        eb('code', 'ilike', searchPattern),
        eb('message', 'ilike', searchPattern),
      ]),
    )
  }

  // Get total count
  const countQuery = db
    .selectFrom('error_log')
    .select((eb) => eb.fn.countAll<number>().as('count'))

  let countQueryWithFilters = countQuery
  if (filters.severity) {
    countQueryWithFilters = countQueryWithFilters.where(
      'severity',
      '=',
      filters.severity,
    )
  }
  if (filters.product) {
    countQueryWithFilters = countQueryWithFilters.where(
      'product',
      '=',
      filters.product,
    )
  }
  if (filters.category) {
    countQueryWithFilters = countQueryWithFilters.where(
      'category',
      '=',
      filters.category,
    )
  }
  if (filters.status) {
    countQueryWithFilters = countQueryWithFilters.where(
      'status',
      '=',
      filters.status,
    )
  }
  if (filters.organizationId) {
    countQueryWithFilters = countQueryWithFilters.where(
      'organizationId',
      '=',
      filters.organizationId,
    )
  }
  if (filters.startDate) {
    countQueryWithFilters = countQueryWithFilters.where(
      'occurredAt',
      '>=',
      new Date(filters.startDate),
    )
  }
  if (filters.endDate) {
    countQueryWithFilters = countQueryWithFilters.where(
      'occurredAt',
      '<=',
      new Date(filters.endDate),
    )
  }
  if (filters.search) {
    const searchPattern = `%${filters.search}%`
    countQueryWithFilters = countQueryWithFilters.where((eb) =>
      eb.or([
        eb('code', 'ilike', searchPattern),
        eb('message', 'ilike', searchPattern),
      ]),
    )
  }

  const countResult = await countQueryWithFilters.executeTakeFirst()
  const total = Number(countResult?.count ?? 0)

  // Apply pagination
  const offset = (filters.page - 1) * filters.limit
  const items = await query.limit(filters.limit).offset(offset).execute()

  return { items, total }
}

export const findById = async (id: string) => {
  return db
    .selectFrom('error_log')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const getStats = async (params: GetErrorLogStatsParams) => {
  const { startDate, endDate, groupBy, organizationId } = params

  const startDateObj = new Date(startDate)
  const endDateObj = new Date(endDate)

  // Build date truncation based on groupBy
  const getDateTrunc = () => {
    switch (groupBy) {
      case 'hour':
        return sql`date_trunc('hour', "occurredAt")`
      case 'week':
        return sql`date_trunc('week', "occurredAt")`
      case 'day':
      default:
        return sql`date_trunc('day', "occurredAt")`
    }
  }

  const dateTrunc = getDateTrunc()

  // Build the query with proper Kysely
  let query = db
    .selectFrom('error_log')
    .select([
      sql<Date>`${dateTrunc}`.as('timestamp'),
      sql<number>`COUNT(*) FILTER (WHERE severity = 'warning')`.as('warning'),
      sql<number>`COUNT(*) FILTER (WHERE severity = 'error')`.as('error'),
      sql<number>`COUNT(*) FILTER (WHERE severity = 'critical')`.as('critical'),
      sql<number>`COUNT(*)`.as('total'),
    ])
    .where('occurredAt', '>=', startDateObj)
    .where('occurredAt', '<=', endDateObj)
    .groupBy(dateTrunc)
    .orderBy(sql`${dateTrunc}`, 'asc')

  if (organizationId) {
    query = query.where('organizationId', '=', organizationId)
  }

  const results = await query.execute()

  const buckets = results.map((row) => ({
    timestamp: (row.timestamp as Date).toISOString(),
    warning: Number(row.warning),
    error: Number(row.error),
    critical: Number(row.critical),
    total: Number(row.total),
  }))

  // Get totals
  let totalsQuery = db
    .selectFrom('error_log')
    .select([
      sql<number>`COUNT(*) FILTER (WHERE severity = 'warning')`.as('warning'),
      sql<number>`COUNT(*) FILTER (WHERE severity = 'error')`.as('error'),
      sql<number>`COUNT(*) FILTER (WHERE severity = 'critical')`.as('critical'),
      sql<number>`COUNT(*)`.as('total'),
    ])
    .where('occurredAt', '>=', startDateObj)
    .where('occurredAt', '<=', endDateObj)

  if (organizationId) {
    totalsQuery = totalsQuery.where('organizationId', '=', organizationId)
  }

  const totalsResults = await totalsQuery.executeTakeFirst()

  const totals = totalsResults
    ? {
        warning: Number(totalsResults.warning),
        error: Number(totalsResults.error),
        critical: Number(totalsResults.critical),
        total: Number(totalsResults.total),
      }
    : { warning: 0, error: 0, critical: 0, total: 0 }

  return { buckets, totals }
}

export const updateStatus = async (
  id: string,
  status: string,
  resolvedBy: string,
  resolutionNote?: string,
) => {
  return db
    .updateTable('error_log')
    .set({
      status,
      resolvedAt: status === 'resolved' ? new Date() : null,
      resolvedBy,
      resolutionNote: resolutionNote ?? null,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

// Get organization name for an error log
export const getOrganizationName = async (
  organizationId: string,
): Promise<string | null> => {
  const org = await db
    .selectFrom('organization')
    .select('name')
    .where('id', '=', organizationId)
    .executeTakeFirst()
  return org?.name ?? null
}

// Get user details for an error log
export const getUserDetails = async (
  userId: string,
): Promise<{ name: string | null; email: string } | null> => {
  const user = await db
    .selectFrom('user')
    .select(['name', 'email'])
    .where('id', '=', userId)
    .executeTakeFirst()
  return user ?? null
}

// Get campaign name
export const getCampaignName = async (
  campaignId: string,
): Promise<string | null> => {
  const campaign = await db
    .selectFrom('campaign')
    .select('name')
    .where('id', '=', campaignId)
    .executeTakeFirst()
  return campaign?.name ?? null
}

// Get lead name
export const getLeadName = async (leadId: string): Promise<string | null> => {
  const lead = await db
    .selectFrom('lead')
    .select(['firstName', 'lastName'])
    .where('id', '=', leadId)
    .executeTakeFirst()
  if (!lead) return null
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || null
}
