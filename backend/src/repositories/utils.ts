import { DBPagination } from '@shared/db/src/types'
import { v4 as uuidv4 } from 'uuid'
import { SelectQueryBuilder } from 'kysely'

export const withId = <T extends object>(data: T): T & { id: string } => {
  return {
    ...data,
    id: uuidv4(),
  }
}

export function withTimestamps<T extends object>(
  data: T,
  isNew = false,
): T & { updatedAt: Date; createdAt?: Date } {
  return {
    ...data,
    ...(isNew && { createdAt: new Date() }),
    updatedAt: new Date(),
  }
}

export const withIdAndTimestamps = <T extends object>(
  data: T,
  isNew = false,
): T & { id: string; updatedAt: Date; createdAt?: Date } => {
  return withId(withTimestamps(data, isNew))
}

export const withPagination = <T>(
  pagination: DBPagination,
  query: SelectQueryBuilder<any, any, T>,
) => {
  // Use explicit offset if provided, otherwise calculate from page
  const offset =
    pagination.offset > 0
      ? pagination.offset
      : (pagination.page - 1) * pagination.limit
  return query.limit(pagination.limit).offset(offset)
}
