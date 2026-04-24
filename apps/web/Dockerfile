FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.json ./


COPY packages/types ./packages/types
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile

WORKDIR /app/apps/web

CMD ["pnpm", "dev", "--host"]