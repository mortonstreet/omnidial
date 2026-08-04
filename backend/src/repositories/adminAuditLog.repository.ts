import { db } from '@/lib/db'
import { withIdAndTimestamps } from './utils'

export interface CreateAuditLogInput {
  adminUserId: string
  action: string
  targetType: string
  targetId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export const create = async (data: CreateAuditLogInput) => {
  const record = withIdAndTimestamps(data, true)
  return db
    .insertInto('admin_audit_log')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findByAdmin = async (adminUserId: string, limit = 50) => {
  return db
    .selectFrom('admin_audit_log')
    .where('adminUserId', '=', adminUserId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .selectAll()
    .execute()
}

export const findRecent = async (limit = 100) => {
  return db
    .selectFrom('admin_audit_log')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .selectAll()
    .execute()
}
