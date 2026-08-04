import { db } from '@/lib/db'
import { withId, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface CreateListInput {
  organizationId: string
  folderId?: string | null
  name: string
  description?: string
  createdById: string
}

export interface UpdateListInput {
  name?: string
  description?: string | null
  folderId?: string | null
  lastModifiedById?: string
}

export interface ListFilters {
  organizationId: string
  folderId?: string
  search?: string
}

export const create = async (data: CreateListInput) => {
  return db
    .insertInto('lead_list')
    .values(
      withId(
        withTimestamps(
          {
            organizationId: data.organizationId,
            folderId: data.folderId ?? null,
            name: data.name,
            description: data.description ?? null,
            createdById: data.createdById,
            lastModifiedById: data.createdById, // Initially same as creator
            importStatus: 'pending',
            leadCount: 0,
          },
          true,
        ),
      ),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string, organizationId: string) => {
  return db
    .selectFrom('lead_list')
    .leftJoin('lead_list_folder', 'lead_list_folder.id', 'lead_list.folderId')
    .where('lead_list.id', '=', id)
    .where('lead_list.organizationId', '=', organizationId)
    .select([
      'lead_list.id',
      'lead_list.organizationId',
      'lead_list.folderId',
      'lead_list.name',
      'lead_list.description',
      'lead_list.leadCount',
      'lead_list.importStatus',
      'lead_list.importError',
      'lead_list.createdById',
      'lead_list.lastModifiedById',
      'lead_list.createdAt',
      'lead_list.updatedAt',
      'lead_list_folder.name as folderName',
    ])
    .executeTakeFirst()
}

export const findMany = async (
  filters: ListFilters,
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('lead_list')
    .leftJoin('lead_list_folder', 'lead_list_folder.id', 'lead_list.folderId')
    .where('lead_list.organizationId', '=', filters.organizationId)

  if (filters.folderId) {
    query = query.where('lead_list.folderId', '=', filters.folderId)
  }

  if (filters.search) {
    query = query.where('lead_list.name', 'ilike', `%${filters.search}%`)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const lists = await withPagination(
    pagination,
    query.select([
      'lead_list.id',
      'lead_list.organizationId',
      'lead_list.folderId',
      'lead_list.name',
      'lead_list.description',
      'lead_list.leadCount',
      'lead_list.importStatus',
      'lead_list.createdById',
      'lead_list.createdAt',
      'lead_list_folder.name as folderName',
    ]),
  )
    .orderBy('lead_list.createdAt', 'desc')
    .execute()

  return { data: lists, total: Number(countResult.count) }
}

export const update = async (
  id: string,
  organizationId: string,
  data: UpdateListInput,
) => {
  return db
    .updateTable('lead_list')
    .set(withTimestamps(data))
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirst()
}

export const updateImportStatus = async (
  id: string,
  status: string,
  error?: string,
) => {
  return db
    .updateTable('lead_list')
    .set({
      importStatus: status,
      importError: error ?? null,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const updateLeadCount = async (id: string) => {
  const count = await db
    .selectFrom('lead_list_entry')
    .where('listId', '=', id)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  await db
    .updateTable('lead_list')
    .set({ leadCount: Number(count.count), updatedAt: new Date() })
    .where('id', '=', id)
    .execute()
}

export const remove = async (id: string, organizationId: string) => {
  const result = await db
    .deleteFrom('lead_list')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}
