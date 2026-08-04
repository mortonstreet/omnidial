import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateFolderInput {
  organizationId: string
  name: string
  color?: string
  parentId?: string | null
  createdById?: string
}

export interface UpdateFolderInput {
  name?: string
  color?: string
  parentId?: string | null
  lastModifiedById?: string
}

export const create = async (data: CreateFolderInput) => {
  // Get max sort order
  const maxOrder = await db
    .selectFrom('lead_list_folder')
    .where('organizationId', '=', data.organizationId)
    .select((eb) => eb.fn.max('sortOrder').as('maxOrder'))
    .executeTakeFirst()

  return db
    .insertInto('lead_list_folder')
    .values({
      ...withId(
        withTimestamps(
          {
            organizationId: data.organizationId,
            name: data.name,
            color: data.color,
            parentId: data.parentId ?? null,
            createdById: data.createdById ?? null,
            lastModifiedById: data.createdById ?? null, // Initially same as creator
          },
          true,
        ),
      ),
      sortOrder: (maxOrder?.maxOrder ?? -1) + 1,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findAll = async (
  organizationId: string,
  parentId?: string | null,
) => {
  let query = db
    .selectFrom('lead_list_folder')
    .where('organizationId', '=', organizationId)

  // If parentId is explicitly null, get root folders
  // If parentId is a string, get children of that folder
  // If parentId is undefined, get all folders
  if (parentId === null) {
    query = query.where('parentId', 'is', null)
  } else if (parentId !== undefined) {
    query = query.where('parentId', '=', parentId)
  }

  return query.selectAll().orderBy('sortOrder', 'asc').execute()
}

export const findById = async (id: string, organizationId: string) => {
  return db
    .selectFrom('lead_list_folder')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
}

export const update = async (
  id: string,
  organizationId: string,
  data: UpdateFolderInput,
) => {
  return db
    .updateTable('lead_list_folder')
    .set(withTimestamps(data))
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirst()
}

export const remove = async (id: string, organizationId: string) => {
  const result = await db
    .deleteFrom('lead_list_folder')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

export const reorder = async (organizationId: string, folderIds: string[]) => {
  for (let i = 0; i < folderIds.length; i++) {
    await db
      .updateTable('lead_list_folder')
      .set({ sortOrder: i, updatedAt: new Date() })
      .where('id', '=', folderIds[i])
      .where('organizationId', '=', organizationId)
      .execute()
  }
}
