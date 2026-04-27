# Hangar

A self-hosted Platform-as-a-Service running on the HashiCorp stack. Push a Git URL — Hangar clones it, builds it into a container image with Railpack, schedules it on Nomad, registers it with Consul, secrets via Vault, and fronts it with Caddy. Build and deploy logs stream to the UI in real time over SSE.

---

## What This Is

Hangar is what Railway, Render, and Brimble look like under the hood — minus the managed cloud. It runs entirely on bare metal (or any Ubuntu server) and is provisioned from scratch with a single command.

The production stack is:

- **Nomad** — container orchestration (replaces `docker run`)
- **Consul** — service discovery (replaces manual port tracking)
- **Vault** — secrets management (replaces `.env` files)
- **Caddy** — dynamic reverse proxy (subdomain per deployment)
- **BuildKit + Railpack** — zero-Dockerfile image builds
- **BullMQ + Redis** — async deployment queue
- **Ansible** — idempotent server provisioning
- **Terraform** — infrastructure provisioning (Hetzner/DigitalOcean)
- **GitHub Actions** — CI, deploy, provision pipelines

---

## Architecture

```
User submits Git URL via UI
          ↓
POST /api/deployments
  → env vars stored in Vault at hangar/data/deployments/{id}/env
  → deployment record created in Postgres
  → job added to BullMQ queue
          ↓
BullMQ worker picks up job
          ↓
┌───────────────────────────────────────────┐
│              Pipeline                     │
│                                           │
│  clone.ts   — git clone to /tmp           │
│  build.ts   — Railpack + BuildKit         │
│               → image built               │
│               → loaded into Docker        │
│               → tagged + pushed to        │
│                 localhost:5000 registry   │
│  run.ts     — reads user env from Vault   │
│               → submitJob to Nomad        │
│  caddy.ts   — polls Consul until          │
│               health check passes         │
│               → patches Caddy admin API   │
└───────────────────────────────────────────┘
          ↓
App live at http://{deploymentId}.localhost
```

Logs are written to Postgres and published to Redis pub/sub simultaneously at every pipeline stage. The SSE endpoint subscribes to the relevant Redis channel and streams log lines to the client in real time — including mid-build output from Railpack and BuildKit.

---

## Repository Structure

```
apps/
  api/                        — Hono API server (TypeScript)
    src/
      lib/
        config.ts             — Vault client, getConfig(), getVault()
        nomad.ts              — submitJob, stopJob, getJobStatus
        emitter.ts            — Redis pub/sub log emitter (own ioredis connections)
        queue.ts              — BullMQ worker
        session.ts            — Redis session management (coming: GitHub OAuth)
      middleware/
        auth.ts               — requireAuth middleware (coming: GitHub OAuth)
      pipeline/
        index.ts              — runPipeline orchestrator
        clone.ts              — git clone
        build.ts              — Railpack + BuildKit image build
        run.ts                — getUserEnv from Vault, submitJob
        caddy.ts              — waitForService, patchCaddy, unpatchCaddy
      routes/
        deployments.ts        — deployment CRUD + health + redeploy
        logs.ts               — SSE log streaming
        auth.ts               — GitHub OAuth routes
      schemas/
        deployments.ts        — Zod + OpenAPI schemas
  web/                        — Vite + TanStack Router + TanStack Query

packages/
  db/                         — Prisma client + shared queries

nomad/
  config/
    nomad.hcl                 — Nomad agent config

consul/
  config/
    consul.hcl                — Consul agent config

vault/
  config/
    vault.hcl                 — Vault server config
  scripts/
    unseal.sh                 — auto-unseal script

ansible/
  playbooks/
    setup.yml                 — full server provisioning
    vault-init.yml            — seeds Vault secrets + creates API token
    deploy.yml                — deploys app via Docker Compose
    templates/                — j2 templates for all systemd services
      vault.service.j2        — systemd service template
      consul.service.j2       — systemd service template
      nomad.service.j2        — systemd service template
      vault-unseal.service.j2 — systemd service template
  group_vars/
    hangar/
      vault.yml               — Ansible Vault encrypted secrets
  requirements.yml            — community.crypto Ansible collection
  inventory.ini               — generated at deploy time

terraform/                    — server provisioning (Hetzner/DigitalOcean)

caddy/
  Caddyfile                   — Caddy config

.github/
  workflows/
    ci.yml                    — lint + typecheck
    deploy.yml                — SSH deploy on push to main
    provision.yml             — Ansible provisioning (manual trigger)

bootstrap.sh                  — machine bootstrap (curl | bash)
deploy.sh                     — full deploy orchestrator
docker-compose.yml            — all app services
```

---

## Running in Development

### Prerequisites

- Docker + Docker Compose
- Node.js 22+ (via NVM recommended)
- pnpm
- Nomad, Consul, Vault installed on the host (see below)
- A running local registry at `localhost:5000`

### 1. Clone the repo

```bash
git clone https://github.com/AdedigbaOluwad1/hangar.git
cd hangar
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment

Copy the example env file:

```bash
cp .env.example .env
```

Minimum required values in `.env`:

```env
VAULT_ADDR=https://host.docker.internal:8200
VAULT_TOKEN=hvs.your-api-token
VAULT_SKIP_VERIFY=true
DATABASE_URL=postgresql://hangar:hangar@postgres:5432/hangar
REDIS_URL=redis://redis:6379
DOCKER_HOST=unix:///var/run/docker.sock
SWAGGER_ENABLED=true
```

### 4. Start HashiCorp services on the host

Install if not already installed:

```bash
sudo apt install consul nomad vault
ansible-galaxy collection install -r ansible/requirements.yml
```

Start Consul:

```bash
consul agent -dev -bind=127.0.0.1 -client=0.0.0.0 &
```

Start Nomad:

```bash
sudo nomad agent -config=nomad/config/nomad.hcl &
```

Start Vault:

```bash
sudo vault server -config=vault/config/vault.hcl &
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true
```

Initialize and unseal Vault (first time only):

```bash
vault operator init
# save the 5 unseal keys and root token
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>
vault login <root-token>
```

Seed secrets:

```bash
vault secrets enable -path=hangar kv-v2

vault kv put hangar/config \
  database_url="postgresql://hangar:hangar@postgres:5432/hangar" \
  redis_url="redis://redis:6379" \
  nomad_addr="http://host.docker.internal:4646" \
  consul_addr="http://host.docker.internal:8500" \
  caddy_admin_url="http://caddy:2019" \
  buildkit_host="tcp://buildkit:1234" \
  github_client_id="your-github-oauth-app-client-id" \
  github_client_secret="your-github-oauth-app-client-secret"

vault policy write hangar-api - <<EOF
path "hangar/data/*" {
  capabilities = ["read"]
}
path "hangar/data/deployments/*" {
  capabilities = ["create", "update", "read", "delete"]
}
EOF

vault token create -policy=hangar-api -display-name=hangar-api
# copy the token → update VAULT_TOKEN in .env
```

### 5. Start the local Docker registry

```bash
docker run -d -p 5000:5000 --restart always --name registry registry:2
```

### 6. Start app services

```bash
docker compose up
```

This starts: `web`, `api`, `caddy`, `buildkit`, `postgres`, `redis`.

### 7. Run database migrations

```bash
docker compose exec api sh -c "cd /app/packages/db && npx prisma migrate deploy"
```

Open [http://localhost](http://localhost).

---

## Deploying an App

### Via UI

1. Open [http://localhost](http://localhost)
2. Paste a Git URL
3. Optionally add environment variables and resource limits
4. Click Deploy
5. Watch logs stream in real time
6. App goes live at `http://{deploymentId}.localhost`

### Via API

```bash
curl -X POST http://localhost/api/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "git",
    "sourceUrl": "https://github.com/render-examples/express-hello-world",
    "env": {
      "MY_SECRET": "value"
    },
    "resources": {
      "cpu": 500,
      "memoryMb": 512
    }
  }'
```

### Test Apps

These work out of the box:

- `https://github.com/render-examples/express-hello-world` — Node.js Express
- `https://github.com/render-examples/flask` — Python Flask
- Any Node.js/Python/Go app that Railpack can detect automatically

---

## API Reference

Interactive docs are available at `http://localhost/api/docs` when `SWAGGER_ENABLED=true`.

### Deployments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/deployments` | List all deployments |
| `POST` | `/api/deployments` | Create a deployment |
| `GET` | `/api/deployments/:id` | Get a single deployment |
| `DELETE` | `/api/deployments/:id` | Stop and delete a deployment |
| `POST` | `/api/deployments/:id/redeploy` | Redeploy from the same source |
| `GET` | `/api/deployments/:id/health` | Check deployment health via Nomad |
| `GET` | `/api/deployments/:id/logs` | Stream build + deploy logs over SSE |

### Auth

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/github` | Redirect to GitHub OAuth |
| `GET` | `/api/auth/github/callback` | OAuth callback — sets session cookie |
| `GET` | `/api/auth/me` | Get the current authenticated user |
| `POST` | `/api/auth/logout` | Clear session |

### Create Deployment

```bash
curl -X POST http://localhost/api/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "git",
    "sourceUrl": "https://github.com/render-examples/express-hello-world",
    "env": {
      "MY_SECRET": "value",
      "API_KEY": "abc123"
    },
    "resources": {
      "cpu": 500,
      "memoryMb": 512
    }
  }'
```

**Response:**

```json
{
  "id": "dep-abc12345",
  "status": "pending",
  "sourceType": "git",
  "sourceUrl": "https://github.com/render-examples/express-hello-world",
  "imageTag": null,
  "containerId": null,
  "port": null,
  "liveUrl": null,
  "createdAt": "2026-04-26T00:00:00.000Z",
  "updatedAt": "2026-04-26T00:00:00.000Z"
}
```

### Deployment Status Values

| Status | Meaning |
|---|---|
| `pending` | In queue, not yet started |
| `building` | Cloning + building image |
| `deploying` | Nomad job submitted, waiting for health check |
| `running` | App is live |
| `failed` | Pipeline error |
| `stopped` | Manually stopped via DELETE |

### Resource Limits

Resource limits are ephemeral — specified per deploy request, not stored in the database. Defaults apply if omitted.

| Field | Default | Min | Max | Unit |
|---|---|---|---|---|
| `cpu` | `500` | `100` | `8000` | MHz |
| `memoryMb` | `512` | `128` | `32768` | MB |

### Redeploy

Creates a brand new deployment from the same source and env. Once the new deployment reaches `running`, the previous deployment is automatically stopped and its Caddy route removed.

```bash
curl -X POST http://localhost/api/deployments/dep-abc12345/redeploy
```

### Health Check

Returns the current Nomad alloc status for a running deployment.

```bash
curl http://localhost/api/deployments/dep-abc12345/health
```

```json
{
  "status": "running",
  "allocId": "abc-def-123"
}
```

---

## Subdomain Routing

Each deployment gets its own subdomain:

```
http://{deploymentId}.localhost
```

Routes are added and removed dynamically via the Caddy admin API — no Caddyfile edits required. The subdomain approach means deployed apps receive requests at `/` and all framework-generated asset paths (Next.js `/_next/static/`, Vite `/@vite/`, etc.) resolve correctly without any `basePath` configuration.

On **Linux** and in **Chrome/Firefox**, `*.localhost` resolves automatically to `127.0.0.1`. On **Windows**, add entries to `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 dep-abc12345.localhost
```

Or use a local DNS tool like `dnsmasq` to resolve `*.localhost` globally.

---

# Provisioning a New Server from Scratch

## Prerequisites

- Ubuntu 24 server with SSH access
- Your Ansible Vault password

## Step 1: Bootstrap

SSH into the server and run:

```bash
curl -fsSL https://raw.githubusercontent.com/AdedigbaOluwad1/hangar/main/bootstrap.sh | bash
```

Or manually:

```bash
git clone https://github.com/AdedigbaOluwad1/hangar.git ~/documents/hangar
cd ~/documents/hangar
chmod +x bootstrap.sh
./bootstrap.sh
```

`bootstrap.sh` installs: `curl`, `git`, `unzip`, `ansible`, `terraform`, Ansible collections. Then hands off to `deploy.sh`.

## Step 2: deploy.sh

`deploy.sh` runs automatically from `bootstrap.sh`. It prompts once for your Ansible Vault password, then runs the full provisioning stack unattended:

```
bootstrap.sh
  └── deploy.sh
        ├── setup.yml
        │     ├── installs Docker, Node, NVM, pnpm, tsx
        │     ├── installs Nomad, Consul, Vault
        │     ├── generates TLS certs for Consul + Vault
        │     ├── starts all systemd services
        │     ├── runs vault operator init (first time only)
        │     ├── saves unseal keys + root token to /etc/vault.d/keys/init.json
        │     ├── unseals Vault
        │     └── enables + starts vault-unseal.service
        │
        ├── deploy.yml
        │     └── docker compose up
        │
        └── vault-init.yml
              ├── reads root token from /etc/vault.d/keys/init.json
              ├── enables KV secrets engine at hangar/
              ├── seeds hangar/config secrets
              ├── creates hangar-api policy + token
              └── writes VAULT_TOKEN to .env
```

Zero manual steps. The server is fully provisioned and the app is live when `deploy.sh` exits.

## What Happens on Reboot

Systemd brings everything back up automatically in the correct order:

```
consul.service → nomad.service → vault.service → vault-unseal.service
```

`vault-unseal.service` reads unseal keys from `/etc/vault.d/keys/init.json` and unseals Vault automatically. No human intervention required.

## Known Issues & Notes

- **Vault init is idempotent** — `setup.yml` checks if Vault is already initialized before running `vault operator init`. Re-running `bootstrap.sh` on an existing server is safe.
- **`/etc/vault.d/keys/init.json`** contains your unseal keys and root token. It is root-owned, `0600`, and never leaves the server. Back it up somewhere secure (password manager, secrets manager) after first provision.
- **Ansible Vault password** — never goes in the repo. It lives in your password manager for manual runs and in `ANSIBLE_VAULT_PASSWORD` as a GitHub secret for CI/CD.
- **Vault sealed after restart** — if `vault-unseal.service` fails for any reason: `export VAULT_ADDR=https://127.0.0.1:8200 && export VAULT_SKIP_VERIFY=true && vault operator unseal`.

## Remote Mode (Terraform)

To provision a fresh Hetzner or DigitalOcean server automatically:

```bash
export HANGAR_MODE=remote
export HETZNER_TOKEN=your-token
export HETZNER_SSH_KEY_NAME=your-key-name
./deploy.sh
```

`deploy.sh` will:

1. Run `terraform apply` to create the server
2. Wait for SSH to become available
3. Generate `inventory.ini` with the server IP
4. Run all Ansible playbooks against it

## GitHub Actions

### CI (`ci.yml`)

Runs on every PR and push to `main`: type check and lint.

### Deploy (`deploy.yml`)

Runs on push to `main`: SSHes into the server, `git pull origin main`, `docker compose up -d --build`.

### Provision (`provision.yml`)

Manual trigger (`workflow_dispatch`): installs Ansible, reads `ANSIBLE_VAULT_PASSWORD` from GitHub secrets, runs full `setup.yml` playbook.

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `ANSIBLE_VAULT_PASSWORD` | Password to decrypt `ansible/group_vars/hangar/vault.yml` |
| `SERVER_HOST` | Server IP or hostname |
| `SERVER_USER` | SSH username |
| `SERVER_SSH_KEY` | Private SSH key for the server |
| `HANGAR_REPO_URL` | Full Git URL of the repository to clone and deploy |
| `HETZNER_TOKEN` | Hetzner API token for Terraform to provision servers |
| `HETZNER_SSH_KEY_NAME` | Name of the SSH key registered in your Hetzner account |

---

## GitHub Actions

### CI (`ci.yml`)

Runs on every PR and push to `main`: type check and lint.

### Deploy (`deploy.yml`)

Runs on push to `main`: SSHes into the server, `git pull origin main`, `docker compose up -d --build`.

### Provision (`provision.yml`)

Manual trigger (`workflow_dispatch`): installs Ansible, reads `ANSIBLE_VAULT_PASSWORD` from GitHub secrets, runs full `setup.yml` playbook.

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `ANSIBLE_VAULT_PASSWORD` | Password to decrypt `ansible/group_vars/hangar/vault.yml` |
| `SERVER_HOST` | Server IP or hostname |
| `SERVER_USER` | SSH username |
| `SERVER_SSH_KEY` | Private SSH key for the server |

---

## Infrastructure Details

### Nomad

| Setting | Value |
|---|---|
| Version | v2.0.0 |
| Data dir | `/opt/nomad/data` |
| Config | `/etc/nomad.d/nomad.hcl` |
| Consul address | `127.0.0.1:8500` (HTTP, for fingerprinting) |
| Docker driver | `allow_privileged = true`, `allow_caps = ["ALL"]` |

Jobs use dynamic ports (assigned by Consul) mapped to container port 3000. Services are registered in Consul with an HTTP health check on `/`. Resource limits default to 500 MHz CPU and 512 MB RAM, configurable per deployment.

### Consul

| Setting | Value |
|---|---|
| Version | v1.22.7 |
| Data dir | `/opt/consul/data` |
| Config | `/etc/consul.d/consul.hcl` |
| HTTP port | `8500` (for Nomad fingerprinting) |
| HTTPS port | `8501` (TLS, self-signed cert) |
| TLS cert | `/opt/consul/tls/consul.crt` |

### Vault

| Setting | Value |
|---|---|
| Version | v2.0.0 |
| Data dir | `/opt/vault/data` |
| Config | `/etc/vault.d/vault.hcl` |
| Address | `https://0.0.0.0:8200` |
| TLS cert | `/opt/vault/tls/vault.crt` |
| Auto-unseal | `vault-unseal.service` reads from `/etc/vault.d/keys/unseal.env` |
| Secrets engine | `kv-v2` at path `hangar/` |

### Vault Secrets

**`hangar/data/config`** — platform config:

```
database_url           postgresql://hangar:hangar@postgres:5432/hangar
redis_url              redis://redis:6379
nomad_addr             http://host.docker.internal:4646
consul_addr            http://host.docker.internal:8500
caddy_admin_url        http://caddy:2019
buildkit_host          tcp://buildkit:1234
github_client_id       (your GitHub OAuth App client ID)
github_client_secret   (your GitHub OAuth App client secret)
```

**`hangar/data/deployments/{id}/env`** — per-deployment user secrets. Created at deploy time, deleted when deployment is stopped.

### Caddy

Caddy runs in Docker and is the single point of ingress. Routes are managed dynamically via the admin API at `http://caddy:2019`.

| Traffic | Handler |
|---|---|
| `localhost/api/*` | API (`api:3001`) — prefix stripped before proxying |
| `localhost` | Frontend (`web:5173`) |
| `{deploymentId}.localhost` | Deployed container (injected dynamically) |

### Local Registry

A local Docker registry runs at `localhost:5000`. After BuildKit builds an image, Hangar loads it into the Docker daemon, tags it as `localhost:5000/hangar-{id}:latest`, and pushes it. Nomad pulls from `localhost:5000` at job start.

The registry is a host-level service, not part of `docker-compose.yml`. Start it once:

```bash
docker run -d -p 5000:5000 --restart always --name registry registry:2
```

---

## Database Schema

```prisma
enum DeploymentStatus {
  pending
  building
  deploying
  running
  failed
  stopped
}

model User {
  id          String       @id
  githubId    Int          @unique
  username    String       @unique
  avatarUrl   String
  accessToken String
  createdAt   DateTime     @default(now())
  deployments Deployment[]
}

model Deployment {
  id          String           @id
  status      DeploymentStatus @default(pending)
  sourceType  String
  sourceUrl   String?
  imageTag    String?
  containerId String?
  port        Int?
  liveUrl     String?
  userId      String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  logs        Log[]
}

model Log {
  id           Int        @id @default(autoincrement())
  deploymentId String
  stream       String
  line         String
  createdAt    DateTime   @default(now())
}
```

---

## TLS

Self-signed certificates are generated by Ansible (`community.crypto`) and stored at `/opt/vault/tls/` and `/opt/consul/tls/`. The API uses `VAULT_SKIP_VERIFY=true` for self-signed certs.

### Switching to Let's Encrypt

Update `vault/config/vault.hcl`:

```hcl
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
  tls_key_file  = "/etc/letsencrypt/live/yourdomain.com/privkey.pem"
}
```

Update `consul/config/consul.hcl`:

```hcl
tls {
  defaults {
    cert_file = "/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
    key_file  = "/etc/letsencrypt/live/yourdomain.com/privkey.pem"
  }
}
```

Remove `VAULT_SKIP_VERIFY=true` from `docker-compose.yml` and the unseal script.

---

## What's Next

- **GitHub OAuth** — private repo support, user-scoped deployments
- **Custom domains** — user-provided domains beyond `.localhost`
- **Auto cert renewal** — Ansible task for Let's Encrypt cert rotation
- **Rollback** — redeploy a previous image tag (data model already supports it)
- **Build cache reuse** — BuildKit cache persistence across deployments
- **Billing/limits** — CPU, memory, deployment count per user

---

## Contributing

```bash
git clone https://github.com/AdedigbaOluwad1/hangar.git
cd hangar
pnpm install
cp .env.example .env
# follow dev setup above
docker compose up
```

PRs welcome. Open an issue first for large changes.

---

## License

MIT