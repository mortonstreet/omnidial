import { Router } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from '@/lib/mcp'
import { validateApiKey } from '@/services/apiKey.service'

const router = Router()

router.post('/sse', async (req, res) => {
  const token = req.headers['x-api-key'] as string | undefined

  if (!token) {
    return res.status(401).json({ error: 'API key required' })
  }

  // Validate API key and get organization context
  const apiKey = await validateApiKey(token)

  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid or expired API key' })
  }

  // Check if API key has mcp:read scope
  const hasScope =
    apiKey.scopes.includes('mcp:read') || apiKey.scopes.includes('*')
  if (!hasScope) {
    return res
      .status(403)
      .json({ error: 'API key does not have mcp:read scope' })
  }

  // Create MCP server with organization context
  const mcpServer = createMcpServer({
    organizationId: apiKey.organizationId,
  })

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  res.on('close', () => {
    transport.close()
  })

  await mcpServer.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

export default router
