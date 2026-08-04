import * as clientService from '@/services/client.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  ListClientsRequest,
  GetClientRequest,
  CreateClientRequest,
  UpdateClientRequest,
  DeleteClientRequest,
} from '@shared/types/src'

export const listClients: AuthRequestHandler<ListClientsRequest> = async (
  req,
  res,
) => {
  const { organizationId } = req.validated

  const clients = await clientService.list(organizationId)
  res.json({ data: clients })
}

export const getClient: AuthRequestHandler<GetClientRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    const client = await clientService.getById(id, organizationId)
    res.json(client)
  } catch (error) {
    res.status(404).json({ error: 'Client not found' })
  }
}

export const createClient: AuthRequestHandler<CreateClientRequest> = async (
  req,
  res,
) => {
  const { organizationId, name, color } = req.validated

  try {
    const client = await clientService.create({
      organizationId,
      name,
      color,
    })

    res.status(201).json(client)
  } catch (error) {
    console.error('Failed to create client:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to create client'
    res.status(500).json({ error: message })
  }
}

export const updateClient: AuthRequestHandler<UpdateClientRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, name, color } = req.validated

  try {
    const client = await clientService.update({
      id,
      organizationId,
      name,
      color,
    })
    res.json(client)
  } catch (error) {
    res.status(404).json({ error: 'Client not found' })
  }
}

export const deleteClient: AuthRequestHandler<DeleteClientRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    await clientService.remove(id, organizationId)
    res.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete client'
    res.status(400).json({ error: message })
  }
}
