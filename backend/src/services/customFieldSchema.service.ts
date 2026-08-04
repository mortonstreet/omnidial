/**
 * Custom Field Schema Service
 *
 * Manages custom field definitions for organizations.
 * These define the available custom fields that can be populated by research.
 */

import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type {
  CustomFieldSchemaResponse,
  CustomFieldType,
} from '@shared/types/src/requests/research'

// === Schema CRUD ===

export async function createSchema(
  organizationId: string,
  createdById: string,
  data: {
    name: string
    label: string
    fieldType?: CustomFieldType
    description?: string
    isRequired?: boolean
    defaultValue?: string
    validationRule?: string
    sortOrder?: number
  },
): Promise<CustomFieldSchemaResponse> {
  // Check for duplicate name
  const existing = await db
    .selectFrom('custom_field_schema')
    .where('organizationId', '=', organizationId)
    .where('name', '=', data.name)
    .selectAll()
    .executeTakeFirst()

  if (existing) {
    throw new Error(`A custom field with name "${data.name}" already exists`)
  }

  const schema = await db
    .insertInto('custom_field_schema')
    .values({
      id: uuidv4(),
      organizationId,
      name: data.name,
      label: data.label,
      fieldType: data.fieldType ?? 'text',
      description: data.description ?? null,
      isRequired: data.isRequired ?? false,
      defaultValue: data.defaultValue ?? null,
      validationRule: data.validationRule ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: true,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformSchema(schema)
}

export async function updateSchema(
  schemaId: string,
  organizationId: string,
  data: {
    label?: string
    description?: string | null
    isRequired?: boolean
    defaultValue?: string | null
    validationRule?: string | null
    sortOrder?: number
    isActive?: boolean
  },
): Promise<CustomFieldSchemaResponse> {
  const existing = await db
    .selectFrom('custom_field_schema')
    .where('id', '=', schemaId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()

  if (!existing) {
    throw new Error('Custom field schema not found')
  }

  const updateData: any = { updatedAt: new Date() }

  if (data.label !== undefined) updateData.label = data.label
  if (data.description !== undefined) updateData.description = data.description
  if (data.isRequired !== undefined) updateData.isRequired = data.isRequired
  if (data.defaultValue !== undefined)
    updateData.defaultValue = data.defaultValue
  if (data.validationRule !== undefined)
    updateData.validationRule = data.validationRule
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const updated = await db
    .updateTable('custom_field_schema')
    .set(updateData)
    .where('id', '=', schemaId)
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformSchema(updated)
}

export async function deleteSchema(
  schemaId: string,
  organizationId: string,
): Promise<void> {
  const existing = await db
    .selectFrom('custom_field_schema')
    .where('id', '=', schemaId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()

  if (!existing) {
    throw new Error('Custom field schema not found')
  }

  // Soft delete by setting isActive to false
  await db
    .updateTable('custom_field_schema')
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where('id', '=', schemaId)
    .execute()
}

export async function listSchemas(
  organizationId: string,
  filters: {
    isActive?: boolean
  },
): Promise<CustomFieldSchemaResponse[]> {
  let query = db
    .selectFrom('custom_field_schema')
    .where('organizationId', '=', organizationId)

  if (filters.isActive !== undefined) {
    query = query.where('isActive', '=', filters.isActive)
  }

  const schemas = await query
    .selectAll()
    .orderBy('sortOrder', 'asc')
    .orderBy('createdAt', 'asc')
    .execute()

  return schemas.map(transformSchema)
}

export async function getSchema(
  schemaId: string,
  organizationId: string,
): Promise<CustomFieldSchemaResponse> {
  const schema = await db
    .selectFrom('custom_field_schema')
    .where('id', '=', schemaId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()

  if (!schema) {
    throw new Error('Custom field schema not found')
  }

  return transformSchema(schema)
}

export async function getSchemaByName(
  organizationId: string,
  name: string,
): Promise<CustomFieldSchemaResponse | null> {
  const schema = await db
    .selectFrom('custom_field_schema')
    .where('organizationId', '=', organizationId)
    .where('name', '=', name)
    .where('isActive', '=', true)
    .selectAll()
    .executeTakeFirst()

  if (!schema) {
    return null
  }

  return transformSchema(schema)
}

// === Validation ===

export async function validateFieldValue(
  schemaId: string,
  organizationId: string,
  value: string,
): Promise<{ valid: boolean; error?: string }> {
  const schema = await getSchema(schemaId, organizationId)

  // Required validation
  if (schema.isRequired && (!value || value.trim() === '')) {
    return { valid: false, error: `${schema.label} is required` }
  }

  // Skip other validations if value is empty and not required
  if (!value || value.trim() === '') {
    return { valid: true }
  }

  // Type-based validation
  switch (schema.fieldType) {
    case 'number':
      if (isNaN(Number(value))) {
        return { valid: false, error: `${schema.label} must be a number` }
      }
      break
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, error: `${schema.label} must be a valid email` }
      }
      break
    case 'url':
      try {
        new URL(value)
      } catch {
        return { valid: false, error: `${schema.label} must be a valid URL` }
      }
      break
    case 'phone':
      if (!/^\+?[\d\s\-()]+$/.test(value)) {
        return {
          valid: false,
          error: `${schema.label} must be a valid phone number`,
        }
      }
      break
    case 'date':
      if (isNaN(Date.parse(value))) {
        return { valid: false, error: `${schema.label} must be a valid date` }
      }
      break
  }

  // Custom validation rule (if provided as JSON)
  if (schema.validationRule) {
    try {
      const rule = JSON.parse(schema.validationRule)

      // Pattern validation
      if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
        return {
          valid: false,
          error: rule.patternMessage ?? `${schema.label} format is invalid`,
        }
      }

      // Min length
      if (rule.minLength && value.length < rule.minLength) {
        return {
          valid: false,
          error: `${schema.label} must be at least ${rule.minLength} characters`,
        }
      }

      // Max length
      if (rule.maxLength && value.length > rule.maxLength) {
        return {
          valid: false,
          error: `${schema.label} must be at most ${rule.maxLength} characters`,
        }
      }

      // Allowed values (for select/multiselect)
      if (rule.allowedValues && !rule.allowedValues.includes(value)) {
        return {
          valid: false,
          error: `${schema.label} must be one of the allowed values`,
        }
      }

      // Min/max for numbers
      if (schema.fieldType === 'number') {
        const numValue = Number(value)
        if (rule.min !== undefined && numValue < rule.min) {
          return {
            valid: false,
            error: `${schema.label} must be at least ${rule.min}`,
          }
        }
        if (rule.max !== undefined && numValue > rule.max) {
          return {
            valid: false,
            error: `${schema.label} must be at most ${rule.max}`,
          }
        }
      }
    } catch {
      // Invalid validation rule JSON, skip custom validation
    }
  }

  return { valid: true }
}

// === Bulk Operations ===

export async function reorderSchemas(
  organizationId: string,
  schemaIds: string[],
): Promise<void> {
  for (let i = 0; i < schemaIds.length; i++) {
    await db
      .updateTable('custom_field_schema')
      .set({
        sortOrder: i,
        updatedAt: new Date(),
      })
      .where('id', '=', schemaIds[i])
      .where('organizationId', '=', organizationId)
      .execute()
  }
}

// === Helper Functions ===

function transformSchema(schema: any): CustomFieldSchemaResponse {
  return {
    id: schema.id,
    organizationId: schema.organizationId,
    name: schema.name,
    label: schema.label,
    fieldType: schema.fieldType as CustomFieldType,
    description: schema.description,
    isRequired: schema.isRequired,
    defaultValue: schema.defaultValue,
    validationRule: schema.validationRule,
    sortOrder: schema.sortOrder,
    isActive: schema.isActive,
    createdById: schema.createdById,
    createdAt: schema.createdAt.toISOString(),
    updatedAt: schema.updatedAt.toISOString(),
  }
}
