import { config } from '@/config'
import { app } from '@/api/app'
import { startWorker } from '@/worker'
import logger from '@/lib/logger'

const asciiArt = `
  
  ██████╗ ████████╗███╗   ███╗
 ██╔════╝ ╚══██╔══╝████╗ ████║
 ██║  ███╗   ██║   ██╔████╔██║
 ██║   ██║   ██║   ██║╚██╔╝██║
 ╚██████╔╝   ██║   ██║ ╚═╝ ██║
  ╚═════╝    ╚═╝   ╚═╝     ╚═╝
`

app.listen(config.port, '0.0.0.0', () => {
  console.log(asciiArt)
  logger.info(`HTTP server listening on port ${config.port}`)
  logger.info(`Backend URL: ${config.backendUrl}`)
  logger.info(`CORS Origin: ${config.corsOrigin}`)
})

startWorker().catch((error: Error) => {
  logger.error(
    { error },
    'Error starting Worker service — HTTP server continues',
  )
})

export default app
