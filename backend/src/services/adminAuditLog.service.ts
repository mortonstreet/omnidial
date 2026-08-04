import * as adminAuditLogRepository from '@/repositories/adminAuditLog.repository'
import logger from '@/lib/logger'

export const logAdminAction = async (
  adminUserId: string,
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
) => {
  try {
    await adminAuditLogRepository.create({
      adminUserId,
      action,
      targetType,
      targetId,
      details,
      ipAddress,
    })
  } catch (error) {
    // Never let audit logging failure break the actual operation
    logger.error(
      { error, action, targetType, targetId },
      'Failed to write admin audit log',
    )
  }
}
