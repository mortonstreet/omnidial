import { db } from '@/lib/db'
import { withId } from './utils'

export interface RecordOpenInput {
  userId: string
  listId?: string
  folderId?: string
}

export const recordOpen = async (data: RecordOpenInput) => {
  return db
    .insertInto('list_open')
    .values(
      withId({
        userId: data.userId,
        listId: data.listId ?? null,
        folderId: data.folderId ?? null,
        openedAt: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findUserRecents = async (
  userId: string,
  organizationId: string,
  limit = 20,
) => {
  // Get recent lists with deduplication (most recent open per list)
  const recentLists = await db
    .selectFrom('list_open')
    .innerJoin('lead_list', 'lead_list.id', 'list_open.listId')
    .leftJoin('lead_list_folder', 'lead_list_folder.id', 'lead_list.folderId')
    .where('list_open.userId', '=', userId)
    .where('lead_list.organizationId', '=', organizationId)
    .where('list_open.listId', 'is not', null)
    .select([
      'list_open.openedAt',
      'lead_list.id',
      'lead_list.organizationId',
      'lead_list.folderId',
      'lead_list.name',
      'lead_list.description',
      'lead_list.leadCount',
      'lead_list.importStatus',
      'lead_list.createdById',
      'lead_list.createdAt',
      'lead_list.updatedAt',
      'lead_list_folder.name as folderName',
    ])
    .distinctOn('lead_list.id')
    .orderBy('lead_list.id')
    .orderBy('list_open.openedAt', 'desc')
    .execute()

  // Get recent folders with deduplication
  const recentFolders = await db
    .selectFrom('list_open')
    .innerJoin('lead_list_folder', 'lead_list_folder.id', 'list_open.folderId')
    .where('list_open.userId', '=', userId)
    .where('lead_list_folder.organizationId', '=', organizationId)
    .where('list_open.folderId', 'is not', null)
    .select([
      'list_open.openedAt',
      'lead_list_folder.id',
      'lead_list_folder.organizationId',
      'lead_list_folder.parentId',
      'lead_list_folder.name',
      'lead_list_folder.color',
      'lead_list_folder.sortOrder',
      'lead_list_folder.createdAt',
      'lead_list_folder.updatedAt',
    ])
    .distinctOn('lead_list_folder.id')
    .orderBy('lead_list_folder.id')
    .orderBy('list_open.openedAt', 'desc')
    .execute()

  // Combine and sort by openedAt
  const allRecents = [
    ...recentLists.map((l) => ({ ...l, type: 'list' as const })),
    ...recentFolders.map((f) => ({ ...f, type: 'folder' as const })),
  ]
    .sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    )
    .slice(0, limit)

  return allRecents
}

export const getLastOpenedByUser = async (userId: string, listId: string) => {
  return db
    .selectFrom('list_open')
    .where('userId', '=', userId)
    .where('listId', '=', listId)
    .select('openedAt')
    .orderBy('openedAt', 'desc')
    .limit(1)
    .executeTakeFirst()
}

export const getLastOpenedFolderByUser = async (
  userId: string,
  folderId: string,
) => {
  return db
    .selectFrom('list_open')
    .where('userId', '=', userId)
    .where('folderId', '=', folderId)
    .select('openedAt')
    .orderBy('openedAt', 'desc')
    .limit(1)
    .executeTakeFirst()
}
