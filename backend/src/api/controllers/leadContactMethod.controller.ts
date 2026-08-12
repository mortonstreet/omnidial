import { AuthRequestHandler } from '@/types/handlers'
import * as contactMethodService from '@/services/leadContactMethod.service'
import type {
  CreateContactMethodRequest,
  DeleteContactMethodRequest,
  ListContactMethodsRequest,
  UpdateContactMethodRequest,
} from '@shared/types/src/requests/leadContactMethod'

const notFound = (error: unknown) =>
  error instanceof Error && /not found/i.test(error.message)

export const listContactMethods: AuthRequestHandler<
  ListContactMethodsRequest
> = async (req, res) => {
  const { organizationId, leadId } = req.validated

  try {
    const data = await contactMethodService.listForLead(organizationId, leadId)
    return res.json({ data })
  } catch (error) {
    return res
      .status(notFound(error) ? 404 : 400)
      .json({ error: (error as Error).message })
  }
}

export const createContactMethod: AuthRequestHandler<
  CreateContactMethodRequest
> = async (req, res) => {
  const { organizationId, leadId, kind, value, label } = req.validated

  try {
    const data = await contactMethodService.addContactMethod(
      organizationId,
      leadId,
      { kind, value, label },
    )
    return res.status(201).json({ data })
  } catch (error) {
    return res
      .status(notFound(error) ? 404 : 400)
      .json({ error: (error as Error).message })
  }
}

export const updateContactMethod: AuthRequestHandler<
  UpdateContactMethodRequest
> = async (req, res) => {
  const { organizationId, id, value, label, isPrimary } = req.validated

  try {
    const data = await contactMethodService.updateContactMethod(
      organizationId,
      id,
      { value, label, isPrimary },
    )
    return res.json({ data })
  } catch (error) {
    return res
      .status(notFound(error) ? 404 : 400)
      .json({ error: (error as Error).message })
  }
}

export const deleteContactMethod: AuthRequestHandler<
  DeleteContactMethodRequest
> = async (req, res) => {
  const { organizationId, id } = req.validated

  try {
    const result = await contactMethodService.deleteContactMethod(
      organizationId,
      id,
    )
    return res.json(result)
  } catch (error) {
    return res
      .status(notFound(error) ? 404 : 400)
      .json({ error: (error as Error).message })
  }
}
