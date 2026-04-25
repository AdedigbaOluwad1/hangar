FROM node:20-slim
RUN apt-get update && apt-get install -y git curl tar && rm -rf /var/lib/apt/lists/*

# install mise
RUN curl -sSL https://mise.run | sh
ENV PATH="/root/.local/bin:$PATH"

# install railpack
RUN curl -sSL https://railpack.com/install.sh | sh

# install pnpm
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages/types ./packages/types
COPY packages/db ./packages/db
COPY apps/api ./apps/api

RUN pnpm install --no-frozen-lockfile
WORKDIR /app/apps/api
COPY --from=moby/buildkit:latest /usr/bin/buildctl /usr/bin/buildctl
CMD ["pnpm", "dev"]