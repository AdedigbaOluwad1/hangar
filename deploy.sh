#!/bin/bash
set -e

# ── Guard ────────────────────────────────────────────────────────────────────

for cmd in ansible ansible-playbook jq curl git nomad; do
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
else
  read -s -p "🔐 Enter Ansible Vault password: " VAULT_PASS < /dev/tty
  echo
  VAULT_PASS_FILE="$SCRIPT_DIR/.vault-pass"
  echo "$VAULT_PASS" > "$VAULT_PASS_FILE"
  chmod 600 "$VAULT_PASS_FILE"
  unset VAULT_PASS
  trap "rm -f $VAULT_PASS_FILE" EXIT
fi

# ── Inventory ────────────────────────────────────────────────────────────────

MODE="${HANGAR_MODE:-local}"

if [ "$MODE" = "remote" ]; then
  if [ -z "$SERVER_HOST" ] || [ -z "$SERVER_USER" ]; then
    echo "❌ SERVER_HOST and SERVER_USER must be set for remote mode."
    exit 1
  fi

  echo "🌍 Remote mode — targeting $SERVER_USER@$SERVER_HOST"

  echo "⏳ Waiting for SSH on $SERVER_HOST..."
  until ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" "echo ready" 2>/dev/null; do
    sleep 5
  done

  cat > "$ANSIBLE_DIR/inventory.ini" << EOF
[hangar]
$SERVER_HOST ansible_user=$SERVER_USER
EOF

else
  echo "💻 Local mode — deploying to localhost..."

  cat > "$ANSIBLE_DIR/inventory.ini" << 'EOF'
[hangar]
localhost ansible_connection=local
EOF
fi

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

# ── Helper: kill stale conmon, deploy a job, wait for health ─────────────────

deploy_job() {
  local job_file=$1
  local service_name=$2

  echo "🐳 Deploying $(basename $job_file)..."

  local port
  port=$(grep -oP 'static\s*=\s*\K[0-9]+' "$job_file" | head -1)
  if [ -n "$port" ]; then
    sudo kill -9 "$(sudo ss -tlnp | grep ":$port" | grep -o 'pid=[0-9]*' | cut -d= -f2)" 2>/dev/null || true
    sudo kill -9 "$(sudo ss -ulnp | grep ":$port" | grep -o 'pid=[0-9]*' | cut -d= -f2)" 2>/dev/null || true
  fi

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

# ── 4. Deploy Nomad infrastructure jobs in startup order ─────────────────────

echo ""
echo "🚀 Deploying Nomad infrastructure jobs..."

deploy_job "$NOMAD_JOBS_DIR/hangar-registry.nomad.hcl"  "registry"
deploy_job "$NOMAD_JOBS_DIR/hangar-postgres.nomad.hcl"  "postgres"
deploy_job "$NOMAD_JOBS_DIR/hangar-redis.nomad.hcl"     "redis"
deploy_job "$NOMAD_JOBS_DIR/hangar-buildkit.nomad.hcl"  "buildkit"
deploy_job "$NOMAD_JOBS_DIR/hangar-caddy.nomad.hcl"     "caddy"

# ── 5. Build + push images, deploy api + web ──────────────────────────────────

echo ""
echo "🚢 Deploying app..."
ansible-playbook \
  -i "$ANSIBLE_DIR/inventory.ini" \
  "$ANSIBLE_DIR/playbooks/deploy.yml" \
  --vault-password-file "$VAULT_PASS_FILE"

# ── 6. Run database migrations ────────────────────────────────────────────────

echo ""
echo "🗄️  Running database migrations..."
ansible-playbook \
  -i "$ANSIBLE_DIR/inventory.ini" \
  "$ANSIBLE_DIR/playbooks/migrate.yml" \
  --vault-password-file "$VAULT_PASS_FILE"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "✅ Hangar is live!"
if [ "$MODE" = "remote" ]; then
  echo "🌐 http://$SERVER_HOST"
else
  echo "🌐 http://localhost"
fi