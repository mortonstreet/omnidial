import { db } from '@/lib/db'
import { withId } from './utils'
import {
  DBPipelineStage,
  InsertDBPipelineStage,
  UpdateDBPipelineStage,
} from '@shared/db/src/types'

export const findByOrganizationId = async (
  organizationId: string,
): Promise<DBPipelineStage[]> => {
  return db
    .selectFrom('pipeline_stage')
    .where('organizationId', '=', organizationId)
    .orderBy('sortOrder', 'asc')
    .selectAll()
    .execute()
}

export const findById = async (
  id: string,
): Promise<DBPipelineStage | undefined> => {
  return db
    .selectFrom('pipeline_stage')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findDefaultByOrganizationId = async (
  organizationId: string,
): Promise<DBPipelineStage | undefined> => {
  return db
    .selectFrom('pipeline_stage')
    .where('organizationId', '=', organizationId)
    .where('isDefault', '=', true)
    .selectAll()
    .executeTakeFirst()
}

export const create = async (
  data: Omit<InsertDBPipelineStage, 'id'>,
): Promise<DBPipelineStage> => {
  return db
    .insertInto('pipeline_stage')
    .values(withId(data))
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (
  id: string,
  data: Omit<UpdateDBPipelineStage, 'id' | 'organizationId' | 'createdAt'>,
): Promise<DBPipelineStage | undefined> => {
  return db
    .updateTable('pipeline_stage')
    .set(data)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const deleteById = async (id: string): Promise<void> => {
  await db.deleteFrom('pipeline_stage').where('id', '=', id).execute()
}

export const updateSortOrders = async (
  stages: { id: string; sortOrder: number }[],
): Promise<void> => {
  await db.transaction().execute(async (trx) => {
    for (const stage of stages) {
      await trx
        .updateTable('pipeline_stage')
        .set({ sortOrder: stage.sortOrder })
        .where('id', '=', stage.id)
        .execute()
    }
  })
}

export const createDefaultStages = async (
  organizationId: string,
): Promise<DBPipelineStage[]> => {
  const defaultStages = [
    { label: 'New', color: '#6B7280', sortOrder: 0, isDefault: true },
    { label: 'Contacted', color: '#3B82F6', sortOrder: 1, isDefault: false },
    { label: 'Qualified', color: '#F59E0B', sortOrder: 2, isDefault: false },
    {
      label: 'Meeting Booked',
      color: '#8B5CF6',
      sortOrder: 3,
      isDefault: false,
    },
    {
      label: 'Proposal Sent',
      color: '#F97316',
      sortOrder: 4,
      isDefault: false,
    },
    { label: 'Closed Won', color: '#10B981', sortOrder: 5, isDefault: false },
    { label: 'Closed Lost', color: '#EF4444', sortOrder: 6, isDefault: false },
  ]

  const results: DBPipelineStage[] = []
  for (const stage of defaultStages) {
    const created = await create({
      organizationId,
      ...stage,
      createdAt: new Date(),
    })
    if (created) results.push(created)
  }
  return results
}

export const clearDefaultFlag = async (
  organizationId: string,
): Promise<void> => {
  await db
    .updateTable('pipeline_stage')
    .set({ isDefault: false })
    .where('organizationId', '=', organizationId)
    .execute()
}
