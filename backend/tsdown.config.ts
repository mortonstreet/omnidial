import { defineConfig } from 'tsdown'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  entry: ['./src/server.ts'],
  outDir: './dist',
  format: 'esm',
  sourcemap: true,
  clean: true,
  shims: true, // Adds __dirname/__filename shims for ESM
  // Keep native/binary deps external
  external: [
    '@sentry/profiling-node',
    'bcrypt',
    'pg-native',
    '@prisma/client',
    '.prisma/client',
  ],
  // Bundle workspace packages
  noExternal: [/@shared\/.*/],
  // Resolve @/ path aliases - use trailing slash for directory matching
  alias: {
    '@/': path.resolve(__dirname, 'src') + '/',
  },
})
