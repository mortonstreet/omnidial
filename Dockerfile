FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# -- Dependencies stage --
FROM base AS deps
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy package.json for each workspace package needed
COPY backend/package.json ./backend/
COPY shared/db/package.json ./shared/db/
COPY shared/types/package.json ./shared/types/

# Install all dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# -- Build stage --
FROM base AS builder
WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/shared/db/node_modules ./shared/db/node_modules
COPY --from=deps /app/shared/types/node_modules ./shared/types/node_modules

# Copy source code
COPY backend ./backend
COPY shared ./shared
COPY package.json pnpm-workspace.yaml tsconfig.json ./

# Generate Prisma client + Kysely types
RUN cd shared/db && npx prisma generate

# Build backend
RUN cd backend && npx tsdown && (cp -r public dist/ 2>/dev/null || true)

# -- Production stage --
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json ./backend/
COPY shared/db/package.json ./shared/db/
COPY shared/types/package.json ./shared/types/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma schema + migrations (needed for db:deploy at startup)
COPY shared/db/prisma ./shared/db/prisma

# Generate Prisma client in the runner stage (pnpm stores it in .pnpm/ store, so copying from builder doesn't work)
RUN cd shared/db && npx prisma generate

# Copy built backend
COPY --from=builder /app/backend/dist ./backend/dist

# Copy shared packages (runtime types/exports)
COPY --from=builder /app/shared ./shared

EXPOSE 8000

# Run migrations then start
CMD ["sh", "-c", "cd shared/db && npx prisma migrate deploy && cd /app && node backend/dist/server.mjs"]
