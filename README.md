# Hangar

A self-hosted Platform-as-a-Service built on the HashiCorp stack. Push a Git URL — Hangar clones it, builds it into a container image with Railpack + BuildKit, schedules it on Nomad, registers it with Consul, manages secrets via Vault, and fronts it with Caddy. Build and deploy logs stream to the UI in real time over SSE.

---

## What This Is

Hangar is what Railway, Render, and Brimble look like under the hood — minus the managed cloud. It runs entirely on bare metal (or any Ubuntu 24 server). Every workload runs as a **Nomad job** with the **Podman driver** — no Docker daemon, no Docker Compose, no Kubernetes.

The production stack:

- **Nomad** — container orchestration; all workloads are Nomad jobs
- **Consul** — service discovery and DNS (`.service.consul` resolves across all containers automatically)
- **Vault** — secrets management with Nomad workload identity JWT auth (no static tokens in job files)
- **Caddy** — dynamic reverse proxy; one subdomain per deployment, routes patched live via admin API
- **BuildKit + Railpack** — zero-Dockerfile image builds; Railpack auto-detects language and generates the build plan
- **BullMQ + Redis** — async deployment queue with real-time log streaming
- **Podman** — rootful container runtime (replaces Docker; no daemon required)
- **dnsmasq** — forwards `.consul` DNS queries to Consul from both host and containers
- **Ansible** — idempotent server provisioning via `deploy.sh`

---

## Architecture

```
User submits Git URL via UI
          ↓
POST /api/deployments
  → deployment record created in Postgres
  → job enqueued in BullMQ (Redis)
          ↓
BullMQ worker picks up job
          ↓
┌─────────────────────────────────────────────────┐
│                   Pipeline                      │
│                                                 │
│  clone.ts    — git clone to /tmp                │
│  build.ts    — Railpack detect + BuildKit build │
│                → image pushed to                │
│                  registry.service.consul:5000   │
│  run.ts      — read user env from Vault         │
│                → submit Nomad job               │
│  caddy.ts    — poll Consul until alloc healthy  │
│                → patch Caddy admin API          │
│                → update deployment liveUrl      │
└─────────────────────────────────────────────────┘
          ↓
App live at http://{deploymentId}.localhost
Logs streamed to UI over SSE from Redis pub/sub
```

---

## Infrastructure Stack

All workloads run as Nomad jobs with the Podman driver. There is no Docker daemon.

### Nomad Jobs

| Job | Type | Port | Notes |
|---|---|---|---|
| `hangar-registry` | service | 5000 (static) | Local OCI registry |
| `hangar-postgres` | service | 5432 (dynamic) | App database |
| `hangar-redis` | service | 6379 (dynamic) | Queue + pub/sub |
| `hangar-buildkit` | service | 1234 (static) | Image builder |
| `hangar-api` | service | 3001 (static) | Hono API server |
| `hangar-web` | service | 5173 (static) | React frontend |
| `hangar-caddy` | service | 80, 2019 (static) | Reverse proxy |

### Networking

- **Podman bridge subnet:** `10.88.0.0/16`, gateway `10.88.0.1` — this is Podman's default and is the same on every machine running rootful Podman
- **Static ports** bind to the host's primary eth0 IP — used only for external access, never for inter-service communication
- **Inter-service communication** exclusively uses Consul DNS: `<service>.service.consul`
- **dnsmasq** listens on `127.0.0.1` and `10.88.0.1` with `bind-dynamic` — starts without the bridge being up and picks it up automatically when the first container runs
- All Nomad jobs include `dns { servers = ["10.88.0.1"] }` in their network block so containers resolve `.consul` hostnames

> **Critical:** `/etc/containers/containers.conf.d/dns.conf` is NOT respected by Nomad-managed containers. Every Nomad job file must include the `dns { servers = ["10.88.0.1"] }` block explicitly. Without it, `.service.consul` hostnames will not resolve inside containers.

### DNS Resolution Chain

```
Container needs postgres.service.consul
  → queries 10.88.0.1:53 (dnsmasq on bridge gateway)
  → dnsmasq forwards *.consul to 10.88.0.1:8600 (Consul DNS)
  → Consul returns current Podman IP of postgres container
  → container connects directly to 10.88.x.x
```

### Service Registration

All Nomad jobs use `address_mode = "driver"` on their `service` and `check` blocks. This registers the container's Podman IP (`10.88.x.x`) in Consul rather than the host eth0 IP. Without this, inter-container communication breaks.

### Caddy Dynamic Routing

Caddy uses `dynamic srv` upstream resolution backed by Consul DNS — no IPs are ever hardcoded in the Caddyfile:

```caddyfile
reverse_proxy {
  dynamic srv {
    name "api.service.consul"
    resolvers 10.88.0.1:8600
    refresh 5s
  }
}
```

On every request, Caddy resolves the current healthy IP from Consul directly. When a container is redeployed and gets a new Podman IP, Caddy picks it up automatically within 5 seconds — no restarts, no SIGHUP, no config changes.

For user-deployed apps, routes are injected at runtime via Caddy's admin API at port 2019.

### Secrets Flow

Vault uses Nomad workload identity (JWT) for auth — no static tokens anywhere in job files:

```
Nomad mints a JWT for each alloc (TTL: 1h)
  → API job presents JWT to Vault at jwt-nomad auth mount
  → Vault validates against Nomad's JWKS endpoint
  → Vault issues a service token scoped to nomad-workloads policy
  → Consul template reads secrets from hangar/data/config
  → Secrets injected as env vars into the container
```

Secrets stored in Vault at `hangar/data/config`:
- `nomad_addr` — Nomad API address reachable from containers
- `consul_addr` — Consul API address reachable from containers
- `nomad_token` — Nomad ACL bootstrap token (used by API to submit user deployment jobs)

---

## Repository Structure

```
apps/
  api/                        — Hono API server (TypeScript)
    src/
      lib/
        config.ts             — Vault client, getConfig(), env loading
        nomad.ts              — submitJob, stopJob, getJobStatus
        emitter.ts            — Redis pub/sub log emitter
        queue.ts              — BullMQ worker setup
        session.ts            — Redis session management
      middleware/
        auth.ts               — requireAuth middleware
      pipeline/
        index.ts              — runPipeline orchestrator
        clone.ts              — git clone
        build.ts              — Railpack detect + BuildKit build + registry push
        run.ts                — getUserEnv from Vault, submitJob to Nomad
        caddy.ts              — waitForService in Consul, patchCaddy, unpatchCaddy
      routes/
        deployments.ts        — deployment CRUD, health, redeploy
        logs.ts               — SSE log streaming from Redis
        auth.ts               — GitHub OAuth routes
      schemas/
        deployments.ts        — Zod + OpenAPI schemas
  web/                        — Vite + React Router + TanStack Query frontend

packages/
  db/                         — Prisma client + shared DB queries

nomad/
  jobs/                       — all Nomad job HCL files
    hangar-api.nomad.hcl
    hangar-web.nomad.hcl
    hangar-caddy.nomad.hcl
    hangar-buildkit.nomad.hcl
    hangar-postgres.nomad.hcl
    hangar-redis.nomad.hcl
    hangar-registry.nomad.hcl
  config/
    nomad.hcl                 — Nomad agent config (ACL, Podman plugin, Vault integration)

consul/
  config/
    consul.hcl                — Consul agent config

vault/
  config/
    vault.hcl                 — Vault server config
  scripts/
    unseal.sh                 — reads unseal keys from /etc/vault.d/keys/init.json (sudo jq)

ansible/
  playbooks/
    setup.yml                 — full server provisioning (packages, DNS, Nomad, Consul, Vault, ACL bootstrap)
    vault-init.yml            — seed Vault secrets from group_vars
    deploy.yml                — build + push API/web images, run Nomad jobs, health check
    templates/
      nomad.hcl.j2            — Jinja2 Nomad config template (nomad_server_count configurable)
  group_vars/
    hangar/
      vault.yml               — ansible-vault encrypted secrets (nomad_addr, consul_addr, caddy_admin_url, etc.)
  inventory.ini               — generated at deploy time (localhost or remote)

deploy.sh                     — single entrypoint: runs setup → vault-init → nomad jobs → deploy
```

---

## Deploying (Production / Staging)

### Prerequisites

- Ubuntu 24 (bare metal or WSL2)
- `ansible`, `ansible-playbook`, `jq`, `curl`, `git`, `nomad` installed on the deploying machine
- An Ansible Vault password

### One Command Deploy

```bash
./deploy.sh
```

`deploy.sh` does everything in order:

1. **Auto-unseals Vault** if it's sealed (reads keys from `/etc/vault.d/keys/init.json`)
2. **Runs `setup.yml`** — installs all packages, configures dnsmasq, Podman, Consul, Nomad, Vault, bootstraps ACLs
3. **Runs `vault-init.yml`** — enables KV engine, seeds `hangar/config` secrets, configures JWT auth for Nomad workload identity
4. **Deploys Nomad infrastructure jobs** in startup order: registry → postgres → redis → buildkit
5. **Runs `deploy.yml`** — builds and pushes `hangar-api` and `hangar-web` images, deploys them as Nomad jobs, waits for health checks
6. **Deploys Caddy** — after API and web are registered healthy in Consul

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HANGAR_MODE` | `local` | Set to `remote` for remote server deploy |
| `SERVER_HOST` | — | Required in remote mode |
| `SERVER_USER` | — | Required in remote mode |
| `ANSIBLE_VAULT_PASSWORD` | — | If set, skips the vault password prompt |

### Remote Deploy

```bash
export HANGAR_MODE=remote
export SERVER_HOST=your.server.ip
export SERVER_USER=ubuntu
./deploy.sh
```

### Secrets (group_vars)

Secrets are stored encrypted in `ansible/group_vars/hangar/vault.yml`. To edit:

```bash
ansible-vault edit ansible/group_vars/hangar/vault.yml
```

Current secrets:

| Key | Value |
|---|---|
| `nomad_addr` | `http://10.88.0.1:4646` |
| `consul_addr` | `http://10.88.0.1:8500` |
| `caddy_admin_url` | `http://caddy.service.consul:2019` |
| `buildkit_host` | `tcp://buildkit.service.consul:1234` |
| `database_url` | `postgresql://hangar:hangar@postgres.service.consul:5432/hangar` |
| `redis_url` | `redis://redis.service.consul:6379` |

---

## Developer Setup (Contributing)

This section covers running Hangar locally for development without using `deploy.sh`. You'll run the infrastructure (Nomad jobs) once and then run the API and web servers directly on the host for fast iteration.

### 1. Prerequisites

Install the following on Ubuntu 24 (or WSL2 on Ubuntu 24):

```bash
# HashiCorp tools
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install -y nomad consul vault

# Podman
sudo apt install -y podman netavark aardvark-dns uidmap

# dnsmasq
sudo apt install -y dnsmasq

# Node.js via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 24 && nvm use 24

# pnpm
npm install -g pnpm
```

### 2. DNS Setup

Configure dnsmasq to forward `.consul` queries to Consul:

```bash
sudo tee /etc/dnsmasq.conf << 'EOF'
server=/consul/10.88.0.1#8600
server=8.8.8.8
server=8.8.4.4
listen-address=127.0.0.1
listen-address=10.88.0.1
bind-dynamic
no-hosts
EOF
```

Disable systemd-resolved (conflicts with dnsmasq on port 53):

```bash
sudo systemctl disable --now systemd-resolved
sudo rm /etc/resolv.conf
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
sudo systemctl restart dnsmasq
```

Configure Podman containers to use the bridge gateway as DNS:

```bash
sudo mkdir -p /etc/containers/containers.conf.d
sudo tee /etc/containers/containers.conf.d/dns.conf << 'EOF'
[containers]
dns_servers = ["10.88.0.1"]
EOF
```

Configure the local registry as insecure:

```bash
sudo mkdir -p /etc/containers/registries.conf.d
sudo tee /etc/containers/registries.conf.d/local.conf << 'EOF'
[[registry]]
location = "registry.service.consul:5000"
insecure = true
EOF
```

Configure BuildKit:

```bash
sudo mkdir -p /etc/buildkit
sudo tee /etc/buildkit/buildkitd.toml << 'EOF'
[registry."registry.service.consul:5000"]
  http = true
  insecure = true
EOF
```

### 3. Start Infrastructure Services

```bash
# Enable rootful Podman socket
sudo systemctl enable --now podman.socket

# Start HashiCorp services
sudo systemctl start consul
sleep 3
sudo systemctl start nomad
sleep 5
sudo systemctl start vault
```

### 4. Initialize Vault (First Time Only)

```bash
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true

# Initialize
vault operator init -key-shares=5 -key-threshold=3 -format=json | \
  sudo tee /etc/vault.d/keys/init.json
sudo chmod 600 /etc/vault.d/keys/init.json

# Unseal (run 3 times with different keys)
export VAULT_TOKEN=$(sudo cat /etc/vault.d/keys/init.json | jq -r '.root_token')
sudo cat /etc/vault.d/keys/init.json | jq -r '.unseal_keys_b64[0]' | xargs vault operator unseal
sudo cat /etc/vault.d/keys/init.json | jq -r '.unseal_keys_b64[1]' | xargs vault operator unseal
sudo cat /etc/vault.d/keys/init.json | jq -r '.unseal_keys_b64[2]' | xargs vault operator unseal
```

### 5. Bootstrap Nomad ACL (First Time Only)

```bash
export NOMAD_ADDR=http://127.0.0.1:4646
nomad acl bootstrap -json | sudo tee /etc/nomad.d/bootstrap.json
sudo chmod 600 /etc/nomad.d/bootstrap.json
export NOMAD_TOKEN=$(sudo cat /etc/nomad.d/bootstrap.json | jq -r '.SecretID')
```

### 6. Seed Vault Secrets

```bash
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true
export VAULT_TOKEN=$(sudo cat /etc/vault.d/keys/init.json | jq -r '.root_token')
export NOMAD_TOKEN=$(sudo cat /etc/nomad.d/bootstrap.json | jq -r '.SecretID')

vault secrets enable -path=hangar kv-v2

vault kv put hangar/config \
  nomad_addr="http://10.88.0.1:4646" \
  consul_addr="http://10.88.0.1:8500" \
  nomad_token="$NOMAD_TOKEN"

# Configure JWT auth for workload identity
vault auth enable -path=jwt-nomad jwt
vault write auth/jwt-nomad/config \
  jwks_url="http://127.0.0.1:4646/.well-known/jwks.json" \
  jwt_supported_algs="RS256,EdDSA" \
  default_role="nomad-workloads"

vault policy write nomad-workloads - <<'EOF'
path "hangar/data/*" {
  capabilities = ["read"]
}
path "hangar/data/deployments/*" {
  capabilities = ["create", "update", "read", "delete"]
}
EOF

vault write auth/jwt-nomad/role/nomad-workloads \
  role_type="jwt" \
  bound_audiences="vault.io" \
  user_claim="/nomad_job_id" \
  user_claim_json_pointer=true \
  token_policies="nomad-workloads" \
  token_period="1h" \
  token_type="service"
```

### 7. Create Data Directories

```bash
sudo mkdir -p /opt/hangar/data/{registry,buildkit,caddy,postgres,redis}
sudo chown -R $USER:$USER /opt/hangar/data/{registry,buildkit,caddy}
sudo chown -R 999:999 /opt/hangar/data/{postgres,redis}
```

### 8. Deploy Infrastructure Nomad Jobs

```bash
export NOMAD_TOKEN=$(sudo cat /etc/nomad.d/bootstrap.json | jq -r '.SecretID')

nomad job run nomad/jobs/hangar-registry.nomad.hcl
nomad job run nomad/jobs/hangar-postgres.nomad.hcl
nomad job run nomad/jobs/hangar-buildkit.nomad.hcl
nomad job run nomad/jobs/hangar-redis.nomad.hcl
nomad job run nomad/jobs/hangar-caddy.nomad.hcl
```

Wait for all jobs to be healthy:

```bash
curl -s http://127.0.0.1:8500/v1/health/service/registry?passing=true | jq '.[0].Service.ID'
curl -s http://127.0.0.1:8500/v1/health/service/postgres?passing=true | jq '.[0].Service.ID'
curl -s http://127.0.0.1:8500/v1/health/service/redis?passing=true | jq '.[0].Service.ID'
curl -s http://127.0.0.1:8500/v1/health/service/buildkit?passing=true | jq '.[0].Service.ID'
curl -s http://127.0.0.1:8500/v1/health/service/caddy?passing=true | jq '.[0].Service.ID'
```

### 9. Run Migrations

```bash
cd packages/db
pnpm prisma migrate deploy
```

### 10. Run API and Web Dev Servers

Open two terminals:

**Terminal 1 — API:**

```bash
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true
export VAULT_TOKEN=$(sudo cat /etc/vault.d/keys/init.json | jq -r '.root_token')
export NOMAD_TOKEN=$(sudo cat /etc/nomad.d/bootstrap.json | jq -r '.SecretID')
export NOMAD_ADDR=http://10.88.0.1:4646
export CONSUL_ADDR=http://10.88.0.1:8500
export DATABASE_URL="postgresql://hangar:hangar@postgres.service.consul:5432/hangar"
export REDIS_URL="redis://redis.service.consul:6379"
export CADDY_ADMIN_URL="http://caddy.service.consul:2019"
export BUILDKIT_HOST="tcp://buildkit.service.consul:1234"
export REGISTRY_HOST="registry.service.consul:5000"

cd apps/api
pnpm dev
```

**Terminal 2 — Web:**

```bash
cd apps/web
pnpm dev
```

The API runs on `http://localhost:3001` and the web on `http://localhost:5173`.

> **Note:** When running the API directly on the host (not as a Nomad job), Vault workload identity JWT auth is not available. Set `VAULT_TOKEN` directly as shown above. The API's `config.ts` falls back to `VAULT_TOKEN` env var when not running inside a Nomad alloc.

### 11. Restarting After a Reboot

After a reboot (or WSL restart), services need to be brought back up in order:

```bash
# Load env
export NOMAD_TOKEN=$(sudo cat /etc/nomad.d/bootstrap.json | jq -r '.SecretID')
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true
export VAULT_TOKEN=$(sudo cat /etc/vault.d/keys/init.json | jq -r '.root_token')

# Start services
sudo systemctl start consul
sleep 3
sudo systemctl start nomad
sleep 3
sudo systemctl start vault
sleep 3

# Unseal Vault
bash vault/scripts/unseal.sh

# Restart dnsmasq (Podman bridge needs to be up first)
sudo systemctl restart dnsmasq

# Redeploy Nomad jobs (or just run deploy.sh)
./deploy.sh
```

---

## Operational Reference

### Environment Variables (Session Setup)

Always load these before running any `nomad` or `vault` CLI commands:

```bash
export NOMAD_TOKEN=$(sudo cat /etc/nomad.d/bootstrap.json | jq -r '.SecretID')
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true
export VAULT_TOKEN=$(sudo cat /etc/vault.d/keys/init.json | jq -r '.root_token')
```

### Manually Redeploying a Job

```bash
export NOMAD_TOKEN=$(sudo cat /etc/nomad.d/bootstrap.json | jq -r '.SecretID')

# Stop and purge (wait for completion)
nomad job stop -purge -detach=false <job-name>

# Force remove any stuck containers
# Note: Podman container names are <shortname>-<uuid>, NOT hangar-<shortname>-<uuid>
sudo podman ps -a --format '{{.ID}} {{.Names}}' | grep "<shortname>" | awk '{print $1}' | xargs -r sudo podman rm -f

# Kill anything holding the port
sudo kill -9 $(sudo ss -tlnp | grep ':<PORT>' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null

# Redeploy
nomad job run nomad/jobs/<job-name>.nomad.hcl
```

### Checking Service Health

```bash
# All registered services
curl -s http://127.0.0.1:8500/v1/catalog/services | jq 'keys'

# Specific service health
curl -s "http://127.0.0.1:8500/v1/health/service/<service>?passing=true" | jq '.[0].Service | {Address, Port}'

# Nomad job status
nomad job status <job-name>

# Nomad alloc logs
nomad alloc logs $(nomad job allocs <job-name> | grep running | awk '{print $1}') <task-name>
```

### Checking What Caddy Is Routing

```bash
# Full Caddy config
curl -s http://<host-ip>:2019/config/ | jq .

# Just the routes
curl -s http://<host-ip>:2019/config/apps/http/servers/srv0/routes | jq .
```

### Vault Operations

```bash
# Check seal status
vault status

# Unseal manually
bash vault/scripts/unseal.sh

# Read current secrets
vault kv get hangar/config

# Update a secret
vault kv patch hangar/config nomad_token="<new-token>"
```

### Nomad ACL Reset (if bootstrap token is lost)

```bash
sudo systemctl stop nomad
sudo sh -c 'echo N > /opt/nomad/data/server/acl-bootstrap-reset'
sudo systemctl start nomad
sleep 8
until curl -sf http://127.0.0.1:4646/v1/status/leader > /dev/null; do sleep 2; done
sudo NOMAD_ADDR=http://127.0.0.1:4646 nomad acl bootstrap -json | sudo tee /etc/nomad.d/bootstrap.json
sudo chmod 600 /etc/nomad.d/bootstrap.json
```

---

## Deploying an App

### Via the UI

Navigate to `http://<host-ip>` and paste a public Git URL into the deployment form.

### Via the API

```bash
curl -X POST http://<host-ip>/api/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "git",
    "sourceUrl": "https://github.com/render-examples/express-hello-world"
  }'
```

Stream logs:

```bash
curl -s http://<host-ip>/api/deployments/<id>/logs
```

### Test Apps

- `https://github.com/render-examples/express-hello-world` — Node.js/Express, detected and built automatically by Railpack

---

## API Reference

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

| Field | Default | Unit |
|---|---|---|
| `cpu` | `500` | MHz |
| `memoryMb` | `512` | MB |

---

## Known Issues & Gotchas

### Stale Podman containers holding ports

Nomad's Podman driver can leave containers stuck in `Stopping` state after a job is stopped. These containers continue to hold their port bindings, preventing new containers from binding the same port. `deploy.sh`'s `deploy_job()` function handles this automatically by force-removing stale containers before every deploy. For manual redeployments:

```bash
sudo podman ps -a --format '{{.ID}} {{.Names}}' | grep "<shortname>" | awk '{print $1}' | xargs -r sudo podman rm -f
sudo kill -9 $(sudo ss -tlnp | grep ':<PORT>' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null
```

Ports to watch: `80`, `2019`, `3001`, `5000`, `5173`, `5432`, `6379`, `1234`.

### BuildKit stale lockfile

BuildKit writes a lockfile at `/opt/hangar/data/buildkit/buildkitd.lock`. If BuildKit crashes, the lockfile persists and the next start fails with `could not lock buildkitd.lock, another instance running?`. The `hangar-buildkit` job has a `prestart` lifecycle task using `raw_exec` that deletes it automatically before every start. If it persists manually:

```bash
sudo rm -f /opt/hangar/data/buildkit/buildkitd.lock
```

### Vault JWT expiry

Nomad workload identity tokens expire after 1 hour. If the API alloc reports `failed to derive Vault token: token is expired`, stop-purge and redeploy the job. Ensure Vault is unsealed first.

### dnsmasq and the Podman bridge

dnsmasq is configured with `bind-dynamic` and listens on both `127.0.0.1` and `10.88.0.1`. The `10.88.0.1` address only exists when at least one Podman container is running (it's the bridge gateway). With `bind-dynamic`, dnsmasq starts without it and binds to it automatically when the bridge comes up. This means DNS from containers works as soon as the first Nomad job starts.

### HCL heredoc indentation

Consul template blocks in Nomad job files must use `<<EOT` (not `<<-EOT`) with zero indentation on the closing `EOT` tag. Indentation causes silent template rendering failures where env vars are empty.

### Nomad job stop is async by default

Always use `-detach=false` when stopping jobs in scripts:

```bash
nomad job stop -purge -detach=false <job-name>
```

Without it, the shell returns immediately while Nomad is still stopping the job, causing race conditions with container cleanup.

### Static ports bind to eth0, not 127.0.0.1

On WSL2, static Nomad ports bind to the WSL eth0 IP (e.g. `172.30.186.74`), not `localhost`. Use the actual IP when accessing services from the host. For localhost access, set `networkingMode=mirrored` in `~/.wslconfig` (Windows) and restart WSL.

### address_mode = "driver" is required on all jobs

All `service` and `check` blocks in Nomad job files must include `address_mode = "driver"`. Without it, Consul registers the host eth0 IP instead of the container's Podman IP. Health checks will fail whenever host port forwarding is interrupted by stale containers.

### raw_exec must be fingerprinted after config changes

If you add or modify the `raw_exec` plugin block in `nomad.hcl`, Nomad must be restarted before it appears in the driver list. Verify with:

```bash
nomad node status -self | grep "Driver Status"
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

## Multinode Cluster Plan

Hangar is designed with multinode in mind. `nomad_server_count` is already a configurable Jinja2 variable in `ansible/playbooks/templates/nomad.hcl.j2` — the single-node default of `1` works today with zero changes. Scaling to a cluster is an Ansible and topology problem, not a code problem.

### Why 10.88.0.1 Is Not a Hardcoding Problem

`10.88.0.0/16` with gateway `10.88.0.1` is Podman's default rootful bridge subnet on every Linux machine. It is not machine-specific — every node in a cluster will have this same gateway. So `dns { servers = ["10.88.0.1"] }` in every Nomad job file works correctly across all nodes without any changes.

Similarly, Vault is bound to `0.0.0.0`, so `https://10.88.0.1:8200` is reachable from inside any Podman container on any node in the cluster via the bridge gateway.

### Target Topology

A production Hangar cluster looks like this:

```
┌──────────────────────────────────────────────────────────┐
│                   SERVER NODES (3)                       │
│                                                          │
│  Nomad Server   ── Raft consensus across 3 nodes         │
│  Consul Server  ── Gossip protocol across 3 nodes        │
│  Vault          ── Active on one node, standby on rest   │
│  Caddy          ── Reverse proxy      (pinned: node-1)   │
│  Registry       ── OCI registry       (pinned: node-1)   │
│  Postgres       ── Database           (pinned: node-1)   │
│  Redis          ── Queue + pub/sub    (pinned: node-1)   │
└──────────────────────────────────────────────────────────┘
                            │
               ┌────────────┼────────────┐
               │            │            │
     ┌─────────┴───┐ ┌──────┴──┐ ┌──────┴──┐
     │  WORKER 1   │ │WORKER 2 │ │WORKER 3 │
     │             │ │         │ │         │
     │ Nomad Client│ │  same   │ │  same   │
     │ Consul Clnt │ │         │ │         │
     │ Podman      │ │         │ │         │
     └─────────────┘ └─────────┘ └─────────┘
           ↑ user hangar-dep-* jobs scheduled here
```

Server nodes run both Nomad server and Nomad client — they participate in Raft consensus AND can run workloads. Stateful infrastructure jobs (Postgres, Redis, Registry, Caddy) are pinned to `node-1` via Nomad node constraints so their data stays in one place. Worker nodes run only Nomad client and Consul client. All user `hangar-dep-*` jobs get scheduled across workers by Nomad's bin-packing scheduler.

### Inventory Structure

```ini
[nomad_servers]
node-1 ansible_host=x.x.x.x ansible_user=ubuntu  # primary — runs infra jobs
node-2 ansible_host=x.x.x.x ansible_user=ubuntu
node-3 ansible_host=x.x.x.x ansible_user=ubuntu

[nomad_clients]
node-4 ansible_host=x.x.x.x ansible_user=ubuntu
node-5 ansible_host=x.x.x.x ansible_user=ubuntu

[hangar:children]
nomad_servers
nomad_clients

[nomad_servers:vars]
nomad_server_count=3
nomad_is_server=true

[nomad_clients:vars]
nomad_server_count=0
nomad_is_server=false
```

### What Needs to Be Built

The following work is needed to go from single-node to cluster. None of it requires changes to the application code or Nomad job files — it is purely Ansible and configuration work.

**1. Split setup.yml into three playbooks:**

```
setup-common.yml  — runs on ALL nodes
                    packages, Podman, dnsmasq, Node.js, pnpm,
                    Consul client config, Nomad client config

setup-server.yml  — runs on nomad_servers only
                    Consul server, Vault, Nomad server+client,
                    ACL bootstrap, Vault init + unseal

setup-client.yml  — runs on nomad_clients only
                    Consul client join, Nomad client join
```

**2. Update nomad.hcl.j2 for role-aware config:**

```hcl
server {
  enabled          = {{ 'true' if nomad_is_server else 'false' }}
  bootstrap_expect = {{ nomad_server_count if nomad_is_server else 0 }}
}

client {
  enabled = true
  servers = ["node-1.internal:4647", "node-2.internal:4647", "node-3.internal:4647"]

  {% if nomad_is_server %}
  host_volume "postgres-data" {
    path      = "/opt/hangar/data/postgres"
    read_only = false
  }
  host_volume "redis-data" {
    path      = "/opt/hangar/data/redis"
    read_only = false
  }
  {% endif %}
}
```

**3. Pin stateful jobs to node-1 via node constraints:**

```hcl
# In hangar-postgres.nomad.hcl, hangar-redis.nomad.hcl,
# hangar-registry.nomad.hcl, hangar-caddy.nomad.hcl:
constraint {
  attribute = "${node.unique.name}"
  value     = "node-1"
}
```

**4. Update Consul config for server clustering:**

Server nodes need `bootstrap_expect = 3` and `retry_join` pointing at each other. Client nodes need `retry_join` pointing at the server nodes. This is currently hardcoded in `consul.hcl` — it needs to become a Jinja2 template like `nomad.hcl.j2`.

**5. Vault HA (optional):**

For true Vault HA, switch the storage backend from file to Consul (`storage "consul" { path = "vault/" }`). This lets standby Vault instances on node-2 and node-3 take over if node-1 goes down. For a first cluster deployment, running Vault only on node-1 and accepting brief unavailability during node-1 restarts is a reasonable starting point.

**6. Registry in multinode:**

The local registry is pinned to node-1. All worker nodes pull images from `registry.service.consul:5000` over the internal network — this works automatically via Consul DNS since every node's Consul client has the full service catalog. No changes needed to job files.

### Deployment Order for Cluster Bootstrap

```bash
# 1. Provision all nodes in parallel
ansible-playbook -i inventory.ini setup-common.yml

# 2. Bootstrap server nodes (Consul quorum, Nomad quorum, Vault init)
ansible-playbook -i inventory.ini setup-server.yml

# 3. Join worker nodes to the cluster
ansible-playbook -i inventory.ini setup-client.yml

# 4. Seed Vault secrets
ansible-playbook -i inventory.ini vault-init.yml

# 5. Deploy infrastructure jobs (pinned to node-1)
# registry → postgres → redis → buildkit → caddy

# 6. Deploy API and web
ansible-playbook -i inventory.ini deploy.yml
```

---

## What's Next

- **Scoped Nomad token** — replace bootstrap token with a least-privilege policy token
- **Windows localhost access** — set `networkingMode=mirrored` in `.wslconfig`
- **Registry GC** — delete old images from the local registry after successful redeploy
- **GitHub OAuth** — private repo support, user-scoped deployments
- **Custom domains** — user-provided domains beyond `.localhost`
- **Build cache reuse** — BuildKit cache persistence across deployments
- **Rollback** — redeploy a previous image tag
- **GitHub Actions CI/CD** — automated deploy pipeline on push
- **Terraform** — infrastructure provisioning for cloud bare metal
- **Multinode** — Ansible playbook split into `setup-common.yml`, `setup-server.yml`, `setup-client.yml` is the remaining implementation work (design complete — see Multinode Cluster Plan above)

---

## License

MIT