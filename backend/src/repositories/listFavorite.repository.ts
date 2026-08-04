import { db } from '@/lib/db'
import { withId } from './utils'

export interface AddFavoriteInput {
  userId: string
  listId?: string
  folderId?: string
}

export const addFavorite = async (data: AddFavoriteInput) => {
  return db
    .insertInto('list_favorite')
    .values(
      withId({
        userId: data.userId,
        listId: data.listId ?? null,
        folderId: data.folderId ?? null,
        createdAt: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const removeFavorite = async (
  userId: string,
  itemId: string,
  type: 'list' | 'folder',
) => {
  let query = db.deleteFrom('list_favorite').where('userId', '=', userId)

  if (type === 'list') {
    query = query.where('listId', '=', itemId)
  } else {
    query = query.where('folderId', '=', itemId)
  }

  const result = await query.executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

export const isFavorited = async (
  userId: string,
  itemId: string,
  type: 'list' | 'folder',
) => {
  let query = db.selectFrom('list_favorite').where('userId', '=', userId)

  if (type === 'list') {
    query = query.where('listId', '=', itemId)
  } else {
    query = query.where('folderId', '=', itemId)
  }

  const result = await query.select('id').executeTakeFirst()
  return !!result
}

export const findUserFavorites = async (
  userId: string,
  organizationId: string,
) => {
  // Get favorited lists
  const favoritedLists = await db
    .selectFrom('list_favorite')
    .innerJoin('lead_list', 'lead_list.id', 'list_favorite.listId')
    .leftJoin('lead_list_folder', 'lead_list_folder.id', 'lead_list.folderId')
    .where('list_favorite.userId', '=', userId)
    .where('lead_list.organizationId', '=', organizationId)
    .where('list_favorite.listId', 'is not', null)
    .select([
      'list_favorite.id as favoriteId',
      'list_favorite.createdAt as favoritedAt',
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
    .orderBy('list_favorite.createdAt', 'desc')
    .execute()

  // Get favorited folders
  const favoritedFolders = await db
    .selectFrom('list_favorite')
    .innerJoin(
      'lead_list_folder',
      'lead_list_folder.id',
      'list_favorite.folderId',
    )
    .where('list_favorite.userId', '=', userId)
    .where('lead_list_folder.organizationId', '=', organizationId)
    .where('list_favorite.folderId', 'is not', null)
    .select([
      'list_favorite.id as favoriteId',
      'list_favorite.createdAt as favoritedAt',
      'lead_list_folder.id',
      'lead_list_folder.organizationId',
      'lead_list_folder.parentId',
      'lead_list_folder.name',
      'lead_list_folder.color',
      'lead_list_folder.sortOrder',
      'lead_list_folder.createdAt',
      'lead_list_folder.updatedAt',
    ])
    .orderBy('list_favorite.createdAt', 'desc')
    .execute()

  return {
    lists: favoritedLists.map((l) => ({
      ...l,
      type: 'list' as const,
    })),
    folders: favoritedFolders.map((f) => ({
      ...f,
      type: 'folder' as const,
    })),
  }
}

export const getFavoriteIds = async (
  userId: string,
  organizationId: string,
) => {
  const listFavorites = await db
    .selectFrom('list_favorite')
    .innerJoin('lead_list', 'lead_list.id', 'list_favorite.listId')
    .where('list_favorite.userId', '=', userId)
    .where('lead_list.organizationId', '=', organizationId)
    .where('list_favorite.listId', 'is not', null)
    .select('list_favorite.listId')
    .execute()

  const folderFavorites = await db
    .selectFrom('list_favorite')
    .innerJoin(
      'lead_list_folder',
      'lead_list_folder.id',
      'list_favorite.folderId',
    )
    .where('list_favorite.userId', '=', userId)
    .where('lead_list_folder.organizationId', '=', organizationId)
    .where('list_favorite.folderId', 'is not', null)
    .select('list_favorite.folderId')
    .execute()

  return {
    listIds: listFavorites.map((f) => f.listId).filter(Boolean) as string[],
    folderIds: folderFavorites
      .map((f) => f.folderId)
      .filter(Boolean) as string[],
  }
}
