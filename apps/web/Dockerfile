FROM node:20-alpine AS base
RUN npm install -g pnpm

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages/types ./packages/types
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app/apps/web
RUN pnpm build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages/types ./packages/types
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile --prod

COPY --from=builder /app/apps/web/build ./apps/web/build

WORKDIR /app/apps/web

ENV PORT=5173

EXPOSE 5173

CMD ["pnpm", "start"]