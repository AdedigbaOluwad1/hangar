# Hangar Production Plan

How Hangar goes from a single-machine homelab PaaS to a production-grade platform: a hardened control plane, a real data layer, private GitHub repos, per-app configuration, custom domains with TLS, multi-node clusters with control and worker nodes, zero-downtime deploys, and autoscaling.

Each phase lists its goal, the work, and a **Done when** checklist. Phases are ordered by dependency; the sequence in §12 is the recommended order of delivery.

---

## 1. Where Hangar is today

One machine runs everything as Nomad jobs on Podman: registry, Postgres, Redis, BuildKit, API, web and Caddy. A deployment flows through one pipeline:

```
POST /deployments → Postgres rows → BullMQ (concurrency 1, inside the API process)
  → git clone (public URL) → Railpack + BuildKit → local registry
  → stop old Nomad job → submit new job (Count 1, port 3000, check "/")
  → poll Consul → PATCH Caddy admin API → http://<deploymentId>.localhost
```

### Gaps

| Area | Today | Risk |
|---|---|---|
| Edge security | Terraform opens **port 2019 (Caddy admin) to `0.0.0.0/0`**; the admin listener binds `0.0.0.0` and allows an empty `Origin`, so any HTTP client can rewrite routes | Anyone on the internet can hijack or delete every route. **Fix first** |
| API security | No authentication, CORS `*`, `userId` nullable and unused | Anyone who reaches the API can deploy, stop or read env vars |
| Secrets in files | Postgres `hangar/hangar` in the job file; registry plain HTTP with no auth | Credential reuse; anyone on the network can push or pull images |
| Cluster security | Consul has no ACLs and no gossip encryption; Nomad/Consul/Vault TLS uses `verify_* = false` / `tls_skip_verify` | Fine on one host, unsafe the moment a second node joins |
| Deploys | `stopJob` runs before the new job is healthy | Downtime on every deploy; a failed build leaves the app down |
| Routing | The full route array is read, modified and `PATCH`ed back into Caddy's in-memory config; first healthy Consul address only | Concurrent deploys lose routes; a Caddy restart loses every app route; no load balancing |
| Data | Single Postgres and Redis on host volumes, no backups | One disk failure loses all state |
| Logs | Every build log line is a Postgres row, no retention; no runtime logs at all | Unbounded table growth; users can't see why a running app crashed |
| Runtime config | `PORT=3000`, health check `/`, `Count: 1`, `dc1`, 500 MHz / 512 MB defaults are hardcoded in `lib/nomad.ts` | Most real apps need different values; nothing can scale |
| Source | Public repos only; commit SHA isn't recorded | No private repos; builds aren't reproducible |
| Queue | Worker runs in the API process; no retries, timeouts or crash recovery; builds stuck in `building` if the process dies | A restart mid-build leaves inconsistent state |
| Topology | Nomad `advertise` is `127.0.0.1`; services register Podman bridge IPs (`10.88.x.x`, identical on every host) | Cannot work across more than one machine (see §8.4) |
| Vault | File storage, manual unseal (`unseal.sh`) | Every reboot needs a human; no HA |

---

## 2. Target architecture

```
                        DNS: hangar.example.com, *.apps.example.com, custom domains
                                              │
                                ┌─────────────▼─────────────┐
                                │  Hetzner Load Balancer    │  TCP 80/443, health-checked
                                └─────────────┬─────────────┘
                      ┌───────────────────────┴───────────────────────┐
              ┌───────▼───────┐                               ┌───────▼───────┐
              │  edge-1       │   Caddy (TLS, routing)        │  edge-2       │
              └───────┬───────┘   certs shared via Consul     └───────┬───────┘
                      │           routes rendered from Consul         │
   ═══════════════════╪════════ private network 10.0.0.0/16 ══════════╪═══════════════
                      │                                               │
   ┌──────────────────┴─────────── CONTROL PLANE (3 nodes) ───────────┴───────────┐
   │  control-1/2/3: Nomad server · Consul server · Vault (Raft)                   │
   │  no user workloads; placement group spread across hosts                      │
   └───────────────────────────────────────────────────────────────────────────────┘
   ┌──────────── WORKERS (Nomad clients + Consul clients, by node pool) ────────────┐
   │  pool "apps"   : user apps, autoscaled 2..N                                    │
   │  pool "builds" : BuildKit + build workers, scaled on queue depth               │
   │  pool "system" : API, web, Nomad Autoscaler, Prometheus, Loki, Grafana         │
   │  pool "data"   : Postgres (+ Patroni later), Redis, pinned host volumes        │
   └────────────────────────────────────────────────────────────────────────────────┘
                                              │
                         Hetzner Object Storage (S3): registry blobs,
                         Postgres WAL/base backups, Loki chunks
```

**Principles**

- **The control plane holds state; workers are cattle.** Any worker can be drained and replaced without losing data, except `data` nodes, which hold pinned volumes and are backed up continuously.
- **Desired state lives in Postgres; the cluster converges to it.** The API never patches running systems with read-modify-write. It writes intent (job specs, routes, domains) and reconcile loops apply it idempotently.
- **One topology, many sizes.** The same roles collapse onto one machine for homelab use (§8.6), so the single-node install keeps working.

---

## 3. Phase 0: Hardening (before anything else)

**Goal:** nothing exploitable on the current single node.

- **Caddy admin:** bind to `127.0.0.1:2019` (or the private interface once clustered); drop the empty origin; remove the `2019` rule from `terraform/main.tf`.
- **Firewall:** public ingress only on 22 (restricted to operator IPs), 80 and 443. Nomad 4646, Consul 8500/8501, Vault 8200 and registry 5000 are private-only.
  - TODO: restrict SSH (22) in `terraform/main.tf` to an `operator_cidrs` variable. Blocked on how `provision.yml` reaches the server, since GitHub-hosted runners SSH in from unpredictable IPs (options: provision from an operator machine, allow the runner IP per run, or provision over Tailscale). The Hetzner firewall already drops 4646, 8500/8501, 8200 and 5000 from outside.
- **API auth stub:** require a static admin token (`Authorization: Bearer`, stored in Vault) on every route except `/health` until real sign-in lands in Phase 2. Restrict CORS to the dashboard origin.
- **Credentials out of job files:** Postgres and Redis passwords generated at install time, stored in Vault, injected with Nomad `template` blocks (the API already uses this path).
- **Registry:** TLS plus htpasswd auth; BuildKit and Nomad's Podman driver get the credentials from Vault.
- **Log hygiene:** a single `writeLog` path that masks known secret values (env vars, tokens) before persisting or emitting.

**Done when**
- [ ] `curl http://<public-ip>:2019/config/` times out from outside the host.
- [ ] Every API route except `/health` returns 401 without a token.
- [ ] No plaintext credential remains in `nomad/jobs/*.hcl` or the repo.
- [ ] The registry rejects unauthenticated pushes.

---

## 4. Phase 1: Data layer

### 4.1 Platform Postgres

| Step | What | Why |
|---|---|---|
| A. Durable single primary | Postgres 16 on a `data` node with a pinned host volume; **WAL-G** continuous WAL archiving plus nightly base backups to Object Storage; 14-day point-in-time recovery | Survives disk loss; RPO ≈ 1 min |
| B. Pooling | PgBouncer (transaction mode) in front; the API connects through it | Connection count stays flat as API replicas grow |
| C. Credentials | Vault **database secrets engine** issues short-lived Postgres roles to the API | No static DB password anywhere |
| D. HA (with the cluster) | **Patroni** with Consul as its DCS (already in the stack), one synchronous replica on a second `data` node; clients follow `primary.postgres.service.consul` | Automatic failover; RTO under a minute |

Managed Postgres stays an option (Step D could be "move to managed"); the plan keeps the connection string as the only coupling, so swapping is a config change.

**Migrations:** `prisma migrate deploy` runs as a one-shot Nomad batch job before each API rollout, never at API startup, so only one process migrates.

### 4.2 Redis and the job queue

- Redis with AOF (`appendfsync everysec`) on a `data` node; Sentinel later if Redis downtime becomes painful. It holds the queue and live log fan-out only, never data that can't be rebuilt.
- **Separate the worker from the API:** `apps/worker` (new package, same pipeline code) runs on `builds` nodes, so API restarts never kill builds and builds scale independently.
- Queues by kind: `build`, `deploy`, `maintenance` (GC, cert checks, reconcile).
- Job options: `attempts` with exponential backoff for transient steps (registry push, Nomad submit), a hard `timeout` per build (default 20 min, configurable), `jobId = buildId` so retries are idempotent.
- **Crash recovery:** on worker start, any build in `building`/`deploying` whose job isn't active is marked `failed` with a system log line, so the UI never shows a build stuck forever.
- **Cancellation:** `POST /builds/:id/cancel` kills the BuildKit session and marks the build `stopped`.

### 4.3 Logs

| Kind | Store | Retention |
|---|---|---|
| Build logs | **Loki** (chunks in Object Storage), labelled `deployment`, `build`, `stream` | 30 days |
| Runtime logs | Loki, shipped by **Grafana Alloy** on every worker from Nomad alloc log dirs | 14 days default, per-plan later |
| Live tail | Redis pub/sub stays for sub-second build streaming; runtime tail uses Loki's tail API over the same SSE endpoint | — |

Postgres keeps only a build summary (status, timings, final error line). The `logs` table is migrated out and dropped after one release.

### 4.4 Registry

- `distribution` with the **S3 storage driver** (Object Storage), TLS and token/htpasswd auth; no local disk dependency, so the registry can run on any `system` node.
- Retention stays "last N versioned tags plus any tag a build still references" (today's rule), with N configurable per deployment; a scheduled `garbage-collect` job reclaims blobs.
- Later: Harbor if vulnerability scanning and per-org projects are wanted.

### 4.5 Schema changes

Keep `Deployment` as "an app" (the dashboard, story and API all use that word) and `Build` as "one release". Add around them:

| Model | Key fields | Purpose |
|---|---|---|
| `User` | `id`, `githubId`, `login`, `email`, `avatarUrl` | Sign-in identity |
| `Org` | `id`, `slug`, `name` | Ownership boundary; every user gets a personal org |
| `Membership` | `orgId`, `userId`, `role` (`owner`, `admin`, `member`, `viewer`) | RBAC |
| `GitInstallation` | `orgId`, `provider`, `installationId`, `accountLogin` | GitHub App installs (§5) |
| `Environment` | `deploymentId`, `name` (`production`, `preview-<pr>`), `branch` | Per-branch / PR deploys |
| `ServiceConfig` | `deploymentId`, `environmentId`, versioned JSON + typed columns for hot fields | Advanced configuration (§6) |
| `EnvVar` | `environmentId`, `key`, `vaultPath`, `isSecret`, `version` | Values stay in Vault; Postgres holds metadata and history |
| `Domain` | `deploymentId`, `hostname`, `status`, `verificationToken`, `isPrimary`, `certStatus` | Custom domains (§7) |
| `AuditLog` | `orgId`, `actorId`, `action`, `target`, `metadata`, `at` | Who did what |
| `Node` (read model) | `nomadNodeId`, `pool`, `status`, `drain` | Cluster view in the dashboard |

`Deployment` gains `orgId` (required after backfill), `repoFullName`, `defaultBranch`, `rootDir`. `Build` gains `commitSha`, `branch`, `triggeredBy` (`user`, `push`, `pull_request`, `rollback`), `startedAt`, `finishedAt`, `nomadDeploymentId`. Existing rows backfill into a default org.

**Done when**
- [ ] A restore drill from Object Storage onto a fresh node recovers the database to within one minute of the failure, documented in `docs/runbooks/restore-postgres.md`.
- [ ] Killing the worker mid-build leaves the build `failed` with a reason, and the next build runs normally.
- [ ] Build and runtime logs for the last 14 days are queryable; the Postgres `logs` table is gone.
- [ ] The registry runs with no local volume.

---

## 5. Phase 2: Identity and private GitHub repos

### 5.1 Why a GitHub App

| Option | Verdict |
|---|---|
| Personal access tokens | Long-lived, user-scoped, broad. Rejected |
| Deploy keys | Per-repo SSH keys; no webhooks, no repo listing, painful at scale. Fallback for non-GitHub hosts only |
| OAuth App | User tokens with broad `repo` scope. Rejected |
| **GitHub App** | Installed on chosen repos only; 1-hour installation tokens minted on demand; webhooks, commit statuses and sign-in from one integration. **Chosen** |

### 5.2 App setup

- **Repository permissions:** Contents (read), Metadata (read), Commit statuses (write), Deployments (write), Pull requests (read).
- **Webhook events:** `push`, `pull_request`, `installation`, `installation_repositories`.
- **User authorization:** "Request user authorization during installation" on, so one flow signs the user in and installs the App.
- **Secrets in Vault** (`hangar/data/github`): App ID, private key (PEM), webhook secret, client ID and secret.

### 5.3 Flows

**Sign in and install**
```
Dashboard "Sign in with GitHub" → GitHub OAuth (App's client) → /auth/github/callback
  → upsert User + personal Org → HttpOnly, SameSite=Lax session cookie
  → if no installation: redirect to the App's install page
  → installation webhook → GitInstallation row
```

**Pick a repo** (replaces the free-text URL for GitHub sources)
```
GET /orgs/:org/repos → mint installation token → GitHub "list repositories for installation"
  → searchable list in the deploy form; public URLs stay supported
```

**Clone**
```
worker: JWT (RS256, 10 min, App private key) → POST /app/installations/:id/access_tokens
  → token (1 h, scoped to that repo, contents:read)
  → git -c credential.helper= -c "http.extraHeader=Authorization: Basic <base64 x-access-token:TOKEN>" \
        clone --depth=1 --branch <branch> https://github.com/<owner>/<repo>
  → record commitSha (git rev-parse HEAD) on the Build
  → token never written to disk, the URL or logs; the mask list includes it
```

**Push to deploy**
```
POST /webhooks/github → verify X-Hub-Signature-256 (HMAC-SHA256, constant-time)
  → dedupe on X-GitHub-Delivery → find Deployments with repo + branch match
  → enqueue build (triggeredBy=push) → commit status "pending" → "success"/"failure" with a dashboard link
```

**Preview environments (later in the phase)**
- `pull_request` opened or synchronized → `Environment preview-<n>` → build and deploy at `pr-<n>-<callsign>.apps.example.com`; closed → stop and delete. Opt-in per deployment; previews count against a per-org limit.

### 5.4 Auth beyond the dashboard

- RBAC enforced in one Hono middleware from `Membership.role`; every route declares the minimum role.
- API tokens (hashed, prefixed `hgr_`, scoped to an org and a role) for a future CLI and CI.
- `AuditLog` written for deploy, redeploy, rollback, env change, domain change, member change.
- Other Git hosts later through a `GitProvider` interface (`listRepos`, `cloneCredentials`, `verifyWebhook`); GitLab is the obvious second implementation.

**Done when**
- [ ] A user signs in with GitHub, installs the App on one private repo, picks it from a list and deploys it without pasting a URL or token.
- [ ] A push to the tracked branch deploys automatically and the commit shows Hangar's status check.
- [ ] Grepping all build logs and Postgres for the installation token finds nothing.
- [ ] A `viewer` gets 403 on deploy, stop and env routes.
- [ ] The story page's "GitHub OAuth" roadmap item drops its "Coming" chip (honest copy rule).

---

## 6. Phase 3: Advanced configuration

### 6.1 Per-deployment settings

Today's hardcoded values in `lib/nomad.ts` become configuration, stored as versioned `ServiceConfig` rows per environment and editable in the dashboard.

| Group | Setting | Default | Maps to |
|---|---|---|---|
| Source | Branch, root directory, watch paths (monorepos: only rebuild when these change) | repo default branch, `/`, `**` | clone + webhook filter |
| Build | Builder (`railpack` or `dockerfile`), Dockerfile path, build args, build command override, build timeout | `railpack`, `Dockerfile`, —, —, 20 min | BuildKit frontend + opts |
| Runtime | Start command override, port, healthcheck path, interval, timeout, grace period | detected, `PORT` env (3000), `/`, 10 s, 2 s, 30 s | Nomad task + `check` |
| Resources | CPU (MHz), memory (MB), memory max (burst) | 500, 512, 1024 | `resources` |
| Scaling | Replicas (fixed) or autoscaling policy (min, max, metric, target) | 1 fixed | `count` / `scaling` (§9) |
| Placement | Node pool, spread across nodes | `apps`, on | `node_pool`, `spread` |
| Lifecycle | Restart policy, deploy strategy (rolling/canary), auto-rollback on failed health | rolling, on | `restart`, `update` |
| Storage | Persistent volume (size, mount path) | none | host volume on a pinned node; CSI later |
| Networking | Public (routed) or internal only (reachable as `<callsign>.service.consul`) | public | route generation |
| Kind | Web service, worker (no port, no route) or cron (schedule) | web | Nomad `service` or `batch` + `periodic` |

Changes that only affect runtime (env, resources, replicas, health check) **redeploy the current image** without a rebuild. Build-affecting changes mark the deployment "needs rebuild".

### 6.2 Environment variables

- Per environment, versioned; values in Vault at `hangar/data/deployments/<id>/<env>/env` (today's path plus the environment segment), metadata and history in `EnvVar`.
- Secret values are write-only in the UI after saving (shown as `••••`, replaceable, never returned by the API).
- Bulk edit as `.env` text; import from a file.
- Shared variable groups at the org level, referenced by name.
- Hangar-provided variables injected automatically: `PORT`, `HANGAR_DEPLOYMENT_ID`, `HANGAR_COMMIT_SHA`, `HANGAR_ENVIRONMENT`, `HANGAR_PUBLIC_URL`.

### 6.3 Config as code: `hangar.toml`

Optional file at the root directory. Values in the file win over UI values; the UI shows which settings are file-managed and locks them.

```toml
[build]
builder = "dockerfile"
dockerfile = "docker/web.Dockerfile"
watch = ["apps/web/**", "packages/**"]

[deploy]
start = "node dist/server.js"
port = 8080
healthcheck = { path = "/healthz", interval = "10s", timeout = "2s" }

[resources]
cpu = 1000
memory = 1024

[scaling]
min = 2
max = 8
metric = "cpu"
target = 70

[[cron]]
name = "nightly-report"
schedule = "0 3 * * *"
command = "node dist/report.js"
```

Parsed with a schema shared through `@hangar/types` (Zod), so the API, worker and dashboard validate the same way. Invalid files fail the build early with a line-numbered error.

### 6.4 Job spec generation

`lib/nomad.ts` becomes a pure function `buildJobSpec(deployment, environment, config, imageTag) → Nomad job JSON`, unit-tested against snapshots for each setting. The worker submits it; nothing else constructs job JSON.

**Done when**
- [ ] An app listening on 8080 with a `/healthz` endpoint deploys with no code changes, configured either in the UI or in `hangar.toml`.
- [ ] Changing an env var redeploys within one minute without rebuilding.
- [ ] A worker (no port) and a cron job deploy and show up correctly in the dashboard.
- [ ] `buildJobSpec` has snapshot tests for every row in §6.1.

---

## 7. Phase 4: Domains and TLS

### 7.1 Domain layout

| Hostname | Points to | Serves |
|---|---|---|
| `hangar.example.com` | Load balancer | Dashboard (`/`) and API (`/api`) |
| `*.apps.example.com` | Load balancer (wildcard A/AAAA) | Every app's default URL |
| `<callsign>.apps.example.com` | (wildcard) | Default app URL, replacing `<deploymentId>.localhost` |
| `pr-<n>-<callsign>.apps.example.com` | (wildcard) | Preview environments |
| Custom, e.g. `shop.acme.com` | CNAME to `<callsign>.apps.example.com`; apex via A/ALIAS to the LB IPs | User domains |

The platform domain and the apps domain are settings in Vault (`hangar/data/config`): `platform_domain`, `apps_domain`. The apps domain should be a **separate registrable domain** (e.g. `hangarapps.net`) in production, so user content can't set cookies on the dashboard's domain; the same domain with a subdomain is fine for homelab installs.

**Callsign renames:** the old hostname keeps routing with a 301 to the new one for 7 days, then is released.

### 7.2 Certificates

| Hostnames | Method |
|---|---|
| `hangar.example.com` | Standard ACME HTTP-01 |
| `*.apps.example.com` | **One wildcard certificate via DNS-01**. Needs a Caddy build with a DNS provider module (`caddy-dns/hetzner` or `caddy-dns/cloudflare`), built with `xcaddy` and pushed to the registry as `hangar-caddy` |
| Custom domains | **Caddy on-demand TLS** (HTTP-01 / TLS-ALPN-01 at first request), gated by an `ask` endpoint so Caddy only requests certificates for verified domains |

```caddyfile
{
  on_demand_tls {
    ask http://api.service.consul:3001/internal/domains/allowed
  }
  storage consul {
    prefix "caddy/certs"
  }
}
```

- `GET /internal/domains/allowed?domain=<host>` returns 200 only for `Domain.status = verified` (or an `*.apps` hostname that maps to a live deployment). It's served on the private network only.
- **Shared certificate storage** in Consul KV (or S3) so every edge node serves the same certificates and ACME locks are coordinated; no edge node holds unique state. The `storage consul` block needs the `caddy-storage-consul` module, added to the same `xcaddy` build as the DNS provider.
- HSTS on the platform domain; optional per custom domain.

### 7.3 Custom domain flow

```
User adds shop.acme.com → Domain(status=pending, verificationToken)
  → dashboard shows two records:
      CNAME shop.acme.com → copper-kestrel.apps.example.com
      TXT   _hangar-challenge.shop.acme.com → <token>
  → maintenance job checks DNS every minute for 72 h (then status=failed, retry button)
  → both resolve → status=verified → route rendered (§8.5) → first HTTPS request issues the cert
  → certStatus=active; renewal is Caddy's job; a daily check flags certs expiring in < 14 days
```

- Several domains per deployment; one is **primary** and the others 301 to it (including `www` ↔ apex).
- Removing a domain removes the route and stops renewal; the cert expires naturally.
- Let's Encrypt rate limits: on-demand issuance is per verified domain only, and verification is required before the `ask` endpoint allows it, so a typo can't burn the limit.

**Done when**
- [ ] A new deployment is live at `https://<callsign>.apps.example.com` with a valid wildcard certificate.
- [ ] A custom domain goes from "Add" to a valid certificate with only the two DNS records, and an unverified hostname pointed at the LB gets no certificate.
- [ ] Restarting or replacing an edge node serves the same certificates with no new ACME orders.
- [ ] The story page's "Custom domains" item drops its "Coming" chip.

---

## 8. Phase 5: Clusters (control and worker nodes)

### 8.1 Node roles

| Role | Count | Runs | Notes |
|---|---|---|---|
| **Control** | 3 (5 for large fleets) | Nomad server, Consul server, Vault server (Raft) | No user workloads (`client.enabled = false`); Hetzner placement group with `spread` so no two share a physical host |
| **Edge** | 2+ | Caddy only, behind the Hetzner LB | `node_pool = "edge"`; the only nodes reachable from the internet (via the LB) |
| **Worker: apps** | 2..N | User apps | Autoscaled (§9.2) |
| **Worker: builds** | 1..N | BuildKit + `apps/worker` | Build-heavy CPU/disk; scaled on queue depth |
| **Worker: system** | 2 | API, web, registry, Nomad Autoscaler, Prometheus, Loki, Grafana | Could merge into `apps` on small clusters |
| **Worker: data** | 1 → 2 | Postgres (Patroni), PgBouncer, Redis | Pinned host volumes; drained only by runbook |

Workers run Nomad **client** + Consul **client** agents. Pools are Nomad **node pools** (Nomad ≥ 1.6); every Hangar job declares its pool, and user jobs default to `apps`.

### 8.2 Sizes

| Tier | Layout | Rough Hetzner shape |
|---|---|---|
| **Homelab** | One node, every role (today) | 1 × CX22 |
| **Small** | 1 control (also edge + system), 2 workers (apps + builds/data) | 1 × CX22, 2 × CX32 |
| **Production** | 3 control, 2 edge, 2 system, 2 data, 2+ apps, 1+ builds | 3 × CX22, 2 × CX22, 2 × CX32, 2 × CCX13, N × CX32/CPX31 |

The same Terraform modules and Ansible roles build every tier; only counts change.

### 8.3 Provisioning

**Terraform** (`terraform/`, split into modules):
- `network`: Hetzner private network `10.0.0.0/16`, subnets per role.
- `firewall`: public 80/443 on edge only; SSH from operator IPs; everything else private.
- `placement`: spread groups for control and data nodes.
- `nodes`: one module instantiated per role with `count`, `server_type`, labels (`role`, `pool`).
- `lb`: Hetzner Load Balancer targeting `role=edge` by label, health check on `:80/health`.
- `dns` (optional): wildcard and platform records through the Hetzner DNS or Cloudflare provider.
- Output: an Ansible inventory grouped by role, generated with `templatefile`.

**Ansible** (`ansible/`, roles instead of one large `setup.yml`):
- `common` (users, SSH hardening, unattended upgrades, Podman, dnsmasq), `consul`, `nomad_server`, `nomad_client`, `vault`, `edge`.
- Playbooks: `site.yml` (full converge), `add-worker.yml`, `drain-and-remove.yml`, `rolling-upgrade.yml`.
- `deploy.sh` keeps its interface: `HANGAR_MODE=local` targets the homelab tier, `remote` targets an inventory from Terraform.

### 8.4 Networking across nodes (the big change)

Today every service registers its **Podman bridge IP** (`address_mode = "driver"`, `10.88.x.x`). Every host has the same bridge range and those IPs aren't routable between hosts, so a container on worker A can't reach one on worker B.

**Change:**
1. **Advertise private IPs:** Nomad and Consul `advertise`/`bind` on the node's private interface (`10.0.x.x`), not `127.0.0.1`.
2. **Host addressing for services:** `address_mode = "host"` on services and checks, with Nomad **dynamic host ports**. Consul then returns `<node private IP>:<port>`, routable from any node; Caddy's `dynamic srv` already consumes SRV records, so it keeps working unchanged.
3. **DNS:** dnsmasq on each node forwards `.consul` to the local Consul client agent; the `dns { servers = ["10.88.0.1"] }` block in jobs stays valid per host.
4. **Later, Consul service mesh** (Connect with Envoy sidecars, CNI bridge mode): mTLS between services and intentions ("only the API may talk to Postgres"). Not needed for the first multi-node release.

### 8.5 Routing in a cluster

The admin-API `PATCH` approach is replaced by **routes rendered from Consul**, so every edge node converges to the same config and a restart loses nothing:

```
API/worker writes desired routes → Consul KV  hangar/routes/<deploymentId>
                                     { hosts: [...], service: "hangar-<id>", redirects: [...] }
Caddy job (edge pool) → Nomad template iterates `ls "hangar/routes"` → Caddyfile
  → change_mode "script": caddy reload (graceful, keeps connections)
Each route upstream → dynamic srv "hangar-<id>.service.consul"
  → load-balances across every healthy instance, on any node, refreshed every 5 s
```

- A **reconcile job** (every 60 s, and on API start) rewrites KV from Postgres, so drift heals itself.
- The Caddy admin API is bound to `127.0.0.1` on edge nodes and isn't used by the platform.
- Redeploys don't touch routes at all: the SRV name stays the same while instances change.

### 8.6 Security in the cluster

- **mTLS** for Nomad, Consul and Vault RPC with a private CA (Vault PKI or `consul tls ca`); `verify_incoming`/`verify_outgoing` on; no `tls_skip_verify`.
- **Consul ACLs** (default deny) and **gossip encryption**; per-agent tokens provisioned by Ansible.
- **Vault:** Raft integrated storage across the 3 control nodes; **auto-unseal** via the Transit engine of a small, separate "unseal Vault" (Hetzner has no KMS), or a cloud KMS if one is available. Today's `unseal.sh` becomes a break-glass runbook.
- Nomad workload identity to Vault stays as today (it already scales to many nodes).

### 8.7 Operations

- **Add a worker:** bump the role's `count` in Terraform → `terraform apply` → `ansible-playbook add-worker.yml`. The node joins via `retry_join` on the control nodes' private IPs (or Consul cloud auto-join if the Hetzner provider is supported).
- **Remove a worker:** `nomad node drain -enable -deadline 10m` → wait for allocations to move → remove from Terraform.
- **Rolling upgrades:** control nodes one at a time (Raft keeps quorum with 2/3); workers drained one at a time; edge nodes taken out of the LB first.
- **Dashboard:** a read-only "Fleet" view of nodes, pools, utilisation and drains, from the Nomad API, admin role only.

**Done when**
- [ ] A Production-tier cluster comes up from `terraform apply` + `ansible-playbook site.yml` with no manual steps besides DNS.
- [ ] Killing any single control node keeps deploys working; killing any single worker reschedules its apps elsewhere within one minute.
- [ ] Rebooting all three control nodes needs no human unseal.
- [ ] A container on one worker reaches a service on another by `.service.consul` name.
- [ ] The story page's "Multi-node" item drops its "Coming" chip.

---

## 9. Phase 6: Zero-downtime deploys and autoscaling

### 9.1 Deploys

Replace stop-then-submit with Nomad's deployment machinery, generated by `buildJobSpec`:

```hcl
update {
  max_parallel      = 1
  canary            = 1          # or = count for blue/green
  auto_promote      = true
  auto_revert       = true
  health_check      = "checks"
  min_healthy_time  = "10s"
  healthy_deadline  = "5m"
  progress_deadline = "10m"
}
```

- The pipeline **never calls `stopJob` on deploy**. It submits the new job version, then follows `GET /v1/deployment/:id` and maps it to build status: canary healthy → promoted → `running`; unhealthy → Nomad reverts → build `failed`, previous version still serving.
- Rollback becomes "submit the job with the old image tag", through the same path, so it's also zero-downtime.
- `Build.nomadDeploymentId` links each build to its Nomad deployment for the dashboard.
- Graceful shutdown: `kill_timeout` (default 30 s) and `shutdown_delay` (5 s) so Caddy stops sending traffic before the old instance exits.

### 9.2 Autoscaling

**Apps (horizontal):** the **Nomad Autoscaler** runs as a `system`-pool job with the Prometheus APM plugin. Each autoscaled deployment's job gets a `scaling` block:

```hcl
scaling {
  enabled = true
  min     = 2
  max     = 8
  policy {
    cooldown            = "2m"
    evaluation_interval = "30s"
    check "cpu" {
      source = "prometheus"
      query  = "avg(nomad_client_allocs_cpu_total_percent{exported_job=\"hangar-<id>\"})"
      strategy "target-value" { target = 70 }
    }
  }
}
```

- Metrics offered in the UI: CPU %, memory %, requests per second per instance (from Caddy's Prometheus metrics, labelled by route) and p95 latency.
- Scaling events are written to `AuditLog` and shown on the deployment page ("Scaled 2 → 4: CPU 84%").
- Guardrails: per-org max instances and total CPU/memory quota; `max` can't exceed it.

**Cluster (nodes):** the same autoscaler scales the `apps` and `builds` pools:
- Strategy: keep pool allocation (CPU/memory reserved by allocations) between 60 % and 80 %; scale `builds` on BuildKit queue depth (BullMQ metrics exported to Prometheus).
- Target plugin: Hetzner isn't one of the officially maintained targets (AWS, Azure, GCP, DigitalOcean). **Decision needed:** adopt a community Hetzner target plugin after review, or write a small one that creates servers from a labelled snapshot with cloud-init that joins the cluster, and drains before deleting. Either way, scale-in always drains first.

**Later:** scale-to-zero for idle apps (needs an edge-side "wake on request" handler that holds the request while the job scales from 0 to 1).

**Done when**
- [ ] Redeploying an app under constant load (e.g. `hey -z 2m`) returns no 5xx and no connection resets.
- [ ] A failed health check on a new version leaves the old version serving and marks the build `failed`.
- [ ] A load test drives an app from 2 to ≥ 4 instances and back to 2 after cooldown, with events shown in the dashboard.
- [ ] Filling the `apps` pool adds a worker node; emptying it drains and removes one.

---

## 10. Phase 7: Observability and operations

- **Metrics:** Prometheus scraping Nomad, Consul, Vault, Caddy, Postgres (postgres_exporter), Redis and BullMQ; **Grafana** dashboards versioned in the repo (`ops/grafana/`).
- **Alerting:** Alertmanager to email/Slack: node down, Raft quorum at risk, Vault sealed, backup older than 24 h, cert expiring in < 14 days, build queue depth above threshold, 5xx rate per app.
- **In the dashboard:** per-deployment CPU, memory, requests and latency sparklines, plus runtime logs with search (Loki). Section 11 of the style guide applies: silent refetches, no motion.
- **CI/CD for Hangar itself:** GitHub Actions running typecheck, lint, tests and `buildJobSpec` snapshots on PRs; on `main`, build and sign the API, worker, web and Caddy images, push them, and deploy to **staging** automatically, then promote to production manually.
- **Runbooks** in `docs/runbooks/`: restore Postgres, Vault break-glass unseal, replace a control node, rotate secrets, drain a data node, rotate the GitHub App key.
- **Targets:** platform API availability 99.9 %; RPO 1 min / RTO 30 min for platform data; a restore drill every month.

---

## 11. Later: managed add-ons

Once the data layer and clusters are stable, Hangar can offer **managed Postgres and Redis for user apps**: one-click add-ons running on the `data` pool with pinned volumes, WAL-G backups and connection strings injected as env vars (`DATABASE_URL`). This builds on Phase 1's tooling and Phase 3's env var injection and is out of scope until both ship.

---

## 12. Recommended sequence

| # | Milestone | Phases | Depends on | Size |
|---|---|---|---|---|
| 1 | Close the open doors | 0 | — | S |
| 2 | Durable data: backups, PgBouncer, Redis AOF, separate worker, crash recovery | 1 (4.1 A–C, 4.2) | 1 | M |
| 3 | Sign-in, orgs and the GitHub App with private repos and push-to-deploy | 2, schema from 4.5 | 2 | L |
| 4 | Advanced configuration, `buildJobSpec`, `hangar.toml` | 3 | 3 | M |
| 5 | Zero-downtime deploys and routes from Consul (still single node) | 6 (9.1), 5 (8.5) | 4 | M |
| 6 | Domains: platform and apps domains, wildcard TLS, custom domains | 4 | 5 | M |
| 7 | Logs to Loki, registry on S3, metrics | 1 (4.3, 4.4), 7 | 2 | M |
| 8 | Multi-node cluster: Terraform modules, Ansible roles, host networking, mTLS, ACLs, Vault HA | 5 | 5, 7 | L |
| 9 | Autoscaling: apps, then nodes | 6 (9.2) | 8 | M |
| 10 | Postgres HA (Patroni), previews, add-ons | 1 (4.1 D), 2, 11 | 8 | L |

Milestones 5 and 6 run on a single node on purpose: zero-downtime deploys, Consul-driven routing and real domains are worth having before there's a second machine, and they remove the two pieces (stop-then-start and admin `PATCH`) that would break first in a cluster.

---

## 13. Open decisions

| Decision | Options | Leaning |
|---|---|---|
| Hetzner cluster autoscaling target | Community plugin vs in-house plugin | Review community plugins first; in-house if they're unmaintained |
| Vault auto-unseal | Transit unseal Vault vs external KMS | Transit (keeps everything on Hetzner) |
| Apps domain | Same domain (`*.apps.example.com`) vs separate (`*.hangarapps.net`) | Separate in production for cookie isolation |
| Platform Postgres HA | Patroni on Consul vs managed Postgres | Patroni (no new vendor, Consul already runs) |
| Log store | Loki vs ClickHouse | Loki (fits Grafana, cheap on object storage) |
| Persistent volumes for user apps | Host volumes pinned to a node vs CSI (Hetzner Volumes CSI) | Host volumes first, CSI with the cluster |
| Service mesh | Consul Connect now vs later | Later; host networking first |
