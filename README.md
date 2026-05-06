# Hangar

A self-hosted Platform-as-a-Service running on the HashiCorp stack. Push a Git URL — Hangar clones it, builds it into a container image with Railpack, schedules it on Nomad, registers it with Consul, secrets via Vault, and fronts it with Caddy. Build and deploy logs stream to the UI in real time over SSE.

---

## What This Is

Hangar is what Railway, Render, and Brimble look like under the hood — minus the managed cloud. It runs entirely on bare metal (or any Ubuntu server). Every component runs as a **Nomad job** with the **Podman driver** — no Docker daemon, no Docker Compose.

The production stack is:

- **Nomad** — container orchestration; all workloads are Nomad jobs
- **Consul** — service discovery and DNS (`.service.consul` resolves across all containers)
- **Vault** — secrets management with workload identity JWT auth
- **Caddy** — dynamic reverse proxy; one subdomain per deployment, patched live via admin API
- **BuildKit + Railpack** — zero-Dockerfile image builds
- **BullMQ + Redis** — async deployment queue
- **Podman** — rootful container runtime (replaces Docker)
- **dnsmasq** — forwards `.consul` DNS queries into Consul from host and containers
- **Ansible** — idempotent server provisioning *(provisioning playbooks are WIP — see note below)*
- **Terraform** — infrastructure provisioning *(WIP)*
- **GitHub Actions** — CI, deploy, provision pipelines *(WIP)*

> **Note:** The Ansible playbooks, Terraform config, `bootstrap.sh`, `deploy.sh`, and GitHub Actions workflows are not yet updated to reflect the Nomad/Podman stack. The provisioning section of this README describes the target state. Current setup is manual — see the [Manual Setup](#manual-setup) section.

---

## Architecture

```
User submits Git URL via UI
          ↓
POST /api/deployments
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
│               → image built by BuildKit   │
│               → pushed directly to        │
│                 registry.service.consul   │
│                 :5000 (local registry)    │
│  run.ts     — reads user env from Vault   │
│               → submitJob to Nomad        │
│  caddy.ts   — polls Consul until alloc    │
│               is healthy                  │
│               → patches Caddy admin API   │
└───────────────────────────────────────────┘
          ↓
App live at http://{deploymentId}.localhost
```

Logs are written to Postgres and published to Redis pub/sub simultaneously at every pipeline stage. The SSE endpoint subscribes to the relevant Redis channel and streams log lines to the client in real time.

---

## Infrastructure Stack

All workloads run as Nomad jobs with the Podman driver. There is no Docker daemon.

### Nomad Jobs

| Job | Type | Port |
|---|---|---|
| `hangar-registry` | system | 5000 |
| `hangar-postgres` | service | 5432 (dynamic) |
| `hangar-redis` | service | 6379 (dynamic) |
| `hangar-buildkit` | service | 1234 |
| `hangar-api` | service | 3001 |
| `hangar-web` | service | 5173 |
| `hangar-caddy` | service | 80, 2019 |

### Networking

- **Podman bridge subnet:** `10.88.0.0/16`, gateway `10.88.0.1`
- **Static ports** bind to the host eth0 IP — used only for external access, never for inter-service communication
- **Inter-service communication** uses Consul DNS: `<service>.service.consul`
- **dnsmasq** forwards `.consul` queries to `10.88.0.1:8600` (Consul DNS) from both host and containers
- All Nomad jobs have `dns { servers = ["10.88.0.1"] }` in their network block so containers resolve `.consul` hostnames

### Registry

Runs as a Nomad system job. Always reachable at `registry.service.consul:5000` regardless of container restarts. Configured as an insecure registry in `/etc/containers/registries.conf.d/local.conf` and in BuildKit's `buildkitd.toml`.

### Secrets

Vault uses Nomad workload identity (JWT) for auth — no static tokens in job files. Secrets are read via Consul template at job start and injected as environment variables. The template block in each job file reads from `hangar/data/config`.

---

## Repository Structure

```
apps/
  api/                        — Hono API server (TypeScript)
    src/
      lib/
        config.ts             — Vault client, getConfig(), getVault()
        nomad.ts              — submitJob, stopJob, getJobStatus
        emitter.ts            — Redis pub/sub log emitter
        queue.ts              — BullMQ worker
        session.ts            — Redis session management
      middleware/
        auth.ts               — requireAuth middleware
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
  jobs/                       — all Nomad job files (.nomad.hcl)
    hangar-api.nomad.hcl
    hangar-web.nomad.hcl
    hangar-caddy.nomad.hcl
    hangar-buildkit.nomad.hcl
    hangar-postgres.nomad.hcl
    hangar-redis.nomad.hcl
    hangar-registry.nomad.hcl
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

ansible/                      — WIP: not yet updated for Nomad/Podman stack
terraform/                    — WIP: not yet updated
.github/workflows/            — WIP: not yet updated
```

---

## Manual Setup

> This is the current dev/production setup path. Ansible provisioning is not yet complete.

### Prerequisites

- Ubuntu 24 (WSL2 or bare metal)
- Nomad, Consul, Vault installed
- Podman (rootful) + aardvark-dns + netavark
- dnsmasq
- Node.js 22+, pnpm

### 1. DNS Setup

Install and configure dnsmasq to forward `.consul` queries to Consul:

```
# /etc/dnsmasq.conf
server=/consul/10.88.0.1#8600
listen-address=10.88.0.1
listen-address=127.0.0.1
bind-interfaces
```

Point `/etc/resolv.conf` at `127.0.0.1`. Configure Podman containers to use `10.88.0.1` as DNS:

```toml
# /etc/containers/containers.conf.d/dns.conf
[containers]
dns_servers = ["10.88.0.1"]
```

> **Important:** The `dns_servers` setting in `containers.conf.d` is not respected by Nomad-launched containers. Each Nomad job must include an explicit `dns { servers = ["10.88.0.1"] }` block in its `network` stanza.

### 2. Registry

Configure Podman to treat the local registry as insecure:

```toml
# /etc/containers/registries.conf.d/local.conf
[[registry]]
location = "registry.service.consul:5000"
insecure = true
```

Configure BuildKit to push to the insecure registry:

```toml
# /etc/buildkit/buildkitd.toml
[registry."registry.service.consul:5000"]
  http = true
  insecure = true
```

### 3. Start Services

```bash
# Start in this order
sudo systemctl start consul
sudo systemctl start nomad
sudo systemctl start vault
sudo systemctl start dnsmasq
```

Unseal Vault:

```bash
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true
export VAULT_TOKEN=$(cat /etc/vault.d/keys/init.json | jq -r '.root_token')
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>
```

### 4. Seed Vault Secrets

```bash
vault secrets enable -path=hangar kv-v2

vault kv put hangar/config \
  nomad_addr="http://127.0.0.1:4646" \
  consul_addr="http://127.0.0.1:8500" \
  nomad_token="<your-nomad-token>"

vault policy write nomad-workloads - <<EOF
path "hangar/data/*" {
  capabilities = ["read"]
}
path "hangar/data/deployments/*" {
  capabilities = ["create", "update", "read", "delete"]
}
EOF
```

### 5. Deploy Nomad Jobs

```bash
export NOMAD_TOKEN=<your-nomad-token>

# Deploy in startup order
nomad job run nomad/jobs/hangar-registry.nomad.hcl
nomad job run nomad/jobs/hangar-postgres.nomad.hcl
nomad job run nomad/jobs/hangar-redis.nomad.hcl
nomad job run nomad/jobs/hangar-buildkit.nomad.hcl
nomad job run nomad/jobs/hangar-caddy.nomad.hcl
```

Build and push the API and web images, then deploy:

```bash
podman build -t registry.service.consul:5000/hangar-api:latest -f apps/api/Dockerfile .
podman push registry.service.consul:5000/hangar-api:latest --tls-verify=false

podman build -t registry.service.consul:5000/hangar-web:latest -f apps/web/Dockerfile .
podman push registry.service.consul:5000/hangar-web:latest --tls-verify=false

nomad job run nomad/jobs/hangar-api.nomad.hcl
nomad job run nomad/jobs/hangar-web.nomad.hcl
```

### 6. Verify

```bash
# All services healthy in Consul
curl -s http://127.0.0.1:8500/v1/catalog/services | jq 'keys'

# API responding
curl http://172.30.186.74:3001/

# Registry reachable
curl http://registry.service.consul:5000/v2/_catalog
```

---

## Redeploying After Code Changes

```bash
export NOMAD_TOKEN=<your-nomad-token>

podman build -t registry.service.consul:5000/hangar-api:latest -f apps/api/Dockerfile .
podman push registry.service.consul:5000/hangar-api:latest --tls-verify=false

nomad job stop -purge hangar-api
sudo kill -9 $(sudo ss -tlnp | grep ':3001' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null
sudo kill -9 $(sudo ss -ulnp | grep ':3001' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null
nomad job run nomad/jobs/hangar-api.nomad.hcl
```

> **Note:** Always kill stale `conmon` processes after stopping a Nomad job before redeploying. Stale processes hold ports and will cause the new alloc to fail with `address already in use`.

---

## Deploying an App

### Via API

```bash
curl -X POST http://172.30.186.74:3001/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "git",
    "sourceUrl": "https://github.com/render-examples/express-hello-world"
  }'
```

Stream logs:

```bash
curl -s http://172.30.186.74:3001/deployments/<id>/logs
```

### Test Apps

- `https://github.com/render-examples/express-hello-world` — Node.js/Express
- Any Node.js, Python, or Go app that Railpack can auto-detect

---

## API Reference

### Deployments

| Method | Path | Description |
|---|---|---|
| `GET` | `/deployments` | List all deployments |
| `POST` | `/deployments` | Create a deployment |
| `GET` | `/deployments/:id` | Get a single deployment |
| `DELETE` | `/deployments/:id` | Stop and delete a deployment |
| `POST` | `/deployments/:id/redeploy` | Redeploy from the same source |
| `GET` | `/deployments/:id/health` | Check deployment health via Nomad |
| `GET` | `/deployments/:id/logs` | Stream build + deploy logs over SSE |

### Deployment Status Values

| Status | Meaning |
|---|---|
| `pending` | In queue, not yet started |
| `building` | Cloning + building image |
| `deploying` | Nomad job submitted, waiting for health check |
| `running` | App is live |
| `failed` | Pipeline error |
| `stopped` | Manually stopped |

### Resource Limits

Specified per deploy request. Defaults apply if omitted.

| Field | Default | Unit |
|---|---|---|
| `cpu` | `500` | MHz |
| `memoryMb` | `512` | MB |

---

## Subdomain Routing

Each deployment gets its own subdomain:

```
http://{deploymentId}.localhost
```

Routes are patched live into Caddy via its admin API at port 2019 — no Caddyfile edits, no restarts. The Caddyfile is rendered by Consul template at Caddy startup and handles base routing:

| Traffic | Handler |
|---|---|
| `*/api/*` | API container (port 3001), prefix stripped |
| `*` (catch-all) | Web frontend (port 5173) |
| `{deploymentId}.localhost` | Deployed app container (injected dynamically) |

On Linux, `*.localhost` resolves to `127.0.0.1` automatically in most browsers.

---

## Known Issues & Operational Notes

### Stale conmon processes

Nomad's Podman driver leaves `conmon` processes holding ports after a job is stopped. Always kill them before redeploying:

```bash
sudo kill -9 $(sudo ss -tlnp | grep ':<PORT>' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null
sudo kill -9 $(sudo ss -ulnp | grep ':<PORT>' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null
```

Ports to watch: `80`, `2019`, `3001`, `5000`, `5173`, `5432`, `6379`, `1234`.

### BuildKit stale lockfile

BuildKit writes a lockfile at `/opt/hangar/data/buildkit/buildkitd.lock`. If BuildKit fails to start, delete it:

```bash
sudo rm -f /opt/hangar/data/buildkit/buildkitd.lock
```

### Vault JWT expiry

Nomad workload identity tokens expire (TTL: 1h). If the API alloc is killed with `failed to derive Vault token: token is expired`, stop-purge and redeploy the job. Make sure Vault is unsealed first.

### Caddy health check

The Caddy Consul health check targets port 2019 (TCP), not port 80. This ensures Caddy registers as healthy in Consul regardless of upstream app status. `CADDY_ADMIN_URL` is only injected into the API via Consul template when Caddy is healthy — if it's missing, Caddy's health check is the first thing to check.

### DNS in Nomad containers

`/etc/containers/containers.conf.d/dns.conf` is not respected by Nomad-managed containers. Every Nomad job file must include:

```hcl
network {
  dns {
    servers = ["10.88.0.1"]
  }
  ...
}
```

Without this, `.service.consul` hostnames will not resolve inside containers.

### HCL heredoc indentation

Consul template blocks in Nomad job files must use `<<EOT` (not `<<-EOT`) with zero indentation on all lines including the closing `EOT`. Indentation causes silent template rendering failures.

### Nomad service address_mode

All `service` and `check` blocks in Nomad job files must include `address_mode = "driver"`. Without it, Consul registers the eth0 IP instead of the Podman container IP.

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

## What's Next

- **Ansible provisioning** — codify manual setup into idempotent playbooks for the Nomad/Podman stack
- **Scoped Nomad token** — replace bootstrap token with a least-privilege policy token
- **Windows access** — set `networkingMode=mirrored` in `.wslconfig` for direct host access
- **Caddy race condition** — auto-restart Caddy alloc when Consul template renders with empty upstreams
- **Registry GC** — delete old images from the local registry after successful redeploy
- **GitHub OAuth** — private repo support, user-scoped deployments
- **Custom domains** — user-provided domains beyond `.localhost`
- **Build cache reuse** — BuildKit cache persistence across deployments
- **Rollback** — redeploy a previous image tag

---

## License

MIT