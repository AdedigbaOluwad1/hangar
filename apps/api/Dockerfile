FROM node:20-slim

RUN apt-get update && apt-get install -y git curl tar && rm -rf /var/lib/apt/lists/*

# install mise
RUN curl -sSL https://mise.run | sh
ENV PATH="/root/.local/bin:$PATH"

# install railpack
RUN curl -sSL https://railpack.com/install.sh | sh

# install pnpm and tsx globally
RUN npm install -g pnpm tsx

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages/types ./packages/types
COPY packages/db ./packages/db
COPY apps/api ./apps/api

RUN pnpm install --no-frozen-lockfile

# generate prisma client inside container
RUN cd /app/packages/db && npx prisma generate

COPY --from=moby/buildkit:latest /usr/bin/buildctl /usr/bin/buildctl

WORKDIR /app/apps/api

CMD ["sh", "-c", "cd /app/packages/db && npx prisma migrate deploy && cd /app/apps/api && tsx watch src/index.ts"]