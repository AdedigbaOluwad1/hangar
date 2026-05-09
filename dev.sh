#!/bin/bash
set -e

# ── Guard ────────────────────────────────────────────────────────────────────

for cmd in ansible ansible-playbook jq curl nomad; do
  if ! command -v $cmd &>/dev/null; then
    echo "❌ $cmd is not installed. Run bootstrap.sh first."
    exit 1
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANSIBLE_DIR="$SCRIPT_DIR/ansible"
NOMAD_JOBS_DIR="$SCRIPT_DIR/nomad/jobs"

# ── Load .env if present ─────────────────────────────────────────────────────

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# ── Vault password ───────────────────────────────────────────────────────────

VAULT_PASS_FILE="${1:-}"

if [ -n "$VAULT_PASS_FILE" ] && [ -f "$VAULT_PASS_FILE" ]; then
  trap "rm -f $VAULT_PASS_FILE" EXIT
elif [ -n "$ANSIBLE_VAULT_PASSWORD" ]; then
  VAULT_PASS_FILE="$SCRIPT_DIR/.vault-pass"
  echo "$ANSIBLE_VAULT_PASSWORD" > "$VAULT_PASS_FILE"
  chmod 600 "$VAULT_PASS_FILE"
  trap "rm -f $VAULT_PASS_FILE" EXIT
elif [ -f "$SCRIPT_DIR/.vault-pass" ]; then
  VAULT_PASS_FILE="$SCRIPT_DIR/.vault-pass"
  trap "rm -f $VAULT_PASS_FILE" EXIT
else
  read -s -p "🔐 Enter Ansible Vault password: " VAULT_PASS < /dev/tty
  echo
  VAULT_PASS_FILE="$SCRIPT_DIR/.vault-pass"
  echo "$VAULT_PASS" > "$VAULT_PASS_FILE"
  chmod 600 "$VAULT_PASS_FILE"
  unset VAULT_PASS
  trap "rm -f $VAULT_PASS_FILE" EXIT
fi

# ── Inventory (always local in dev) ──────────────────────────────────────────

cat > "$ANSIBLE_DIR/inventory.ini" << 'EOF'
[nomad_servers]
localhost ansible_connection=local

[nomad_clients]

[hangar:children]
nomad_servers
nomad_clients

[nomad_servers:vars]
nomad_server_count=1

[nomad_clients:vars]
nomad_server_count=0
EOF

# ── Helper: wait for a Consul service to be healthy ──────────────────────────

wait_for_service() {
  local service=$1
  local max_attempts=${2:-30}
  local attempt=0

  echo "⏳ Waiting for $service to be healthy in Consul..."
  until curl -sf "http://127.0.0.1:8500/v1/health/service/$service?passing=true" \
    | jq -e '.[0]' > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "❌ $service did not become healthy after $max_attempts attempts."
      exit 1
    fi
    sleep 3
  done
  echo "✅ $service is healthy"
}

# ── Helper: deploy a Nomad job ────────────────────────────────────────────────

deploy_job() {
  local job_file=$1
  local service_name=$2
  local job_name
  job_name=$(basename "$job_file" .nomad.hcl)

  echo "🐳 Deploying $job_name..."

  NOMAD_TOKEN="$NOMAD_TOKEN" nomad job stop -purge -detach=false "$job_name" 2>/dev/null || true

  local short_name
  short_name=$(echo "$job_name" | sed 's/^hangar-//')
  sudo podman ps -a --format '{{.ID}} {{.Names}}' | grep "$short_name" | awk '{print $1}' | \
    xargs -r sudo podman rm -f 2>/dev/null || true

  local port
  port=$(grep -oP 'static\s*=\s*\K[0-9]+' "$job_file" | head -1)
  if [ -n "$port" ]; then
    sudo kill -9 "$(sudo ss -tlnp | grep ":$port" | grep -o 'pid=[0-9]*' | cut -d= -f2)" 2>/dev/null || true
    sudo kill -9 "$(sudo ss -ulnp | grep ":$port" | grep -o 'pid=[0-9]*' | cut -d= -f2)" 2>/dev/null || true
  fi

  sleep 2

  NOMAD_TOKEN="$NOMAD_TOKEN" nomad job run "$job_file"

  if [ -n "$service_name" ]; then
    wait_for_service "$service_name"
  fi
}

# ── 1. Infrastructure setup ───────────────────────────────────────────────────

echo ""
echo "⚙️  Running infrastructure setup..."
ansible-playbook \
  -i "$ANSIBLE_DIR/inventory.ini" \
  "$ANSIBLE_DIR/playbooks/setup.yml" \
  --vault-password-file "$VAULT_PASS_FILE"

# ── 2. Initialize Vault secrets ───────────────────────────────────────────────

echo ""
echo "🔐 Initializing Vault secrets..."
ansible-playbook \
  -i "$ANSIBLE_DIR/inventory.ini" \
  "$ANSIBLE_DIR/playbooks/vault-init.yml" \
  --vault-password-file "$VAULT_PASS_FILE"

# ── 3. Load Nomad token ───────────────────────────────────────────────────────

export NOMAD_TOKEN
NOMAD_TOKEN=$(sudo cat /etc/nomad.d/bootstrap.json | jq -r '.SecretID')

# ── 4. Deploy infrastructure jobs only ───────────────────────────────────────

echo ""
echo "🚀 Deploying infrastructure jobs..."

deploy_job "$NOMAD_JOBS_DIR/hangar-registry.nomad.hcl"  "registry"
deploy_job "$NOMAD_JOBS_DIR/hangar-postgres.nomad.hcl"  "postgres"
deploy_job "$NOMAD_JOBS_DIR/hangar-redis.nomad.hcl"     "redis"
deploy_job "$NOMAD_JOBS_DIR/hangar-buildkit.nomad.hcl"  "buildkit"
deploy_job "$NOMAD_JOBS_DIR/hangar-caddy.nomad.hcl"     "caddy"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "✅ Infrastructure ready!"
echo ""
echo "👉 Now run:"
echo "   export VAULT_TOKEN=\$(sudo cat /etc/vault.d/keys/init.json | jq -r '.root_token')"
echo "   export NOMAD_TOKEN=\$(sudo cat /etc/nomad.d/deploy.json | jq -r '.SecretID')"
echo "   pnpm dev"