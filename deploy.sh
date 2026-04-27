#!/bin/bash
set -e

# guard — check required tools are installed
for cmd in ansible terraform unzip curl git; do
  if ! command -v $cmd &>/dev/null; then
    echo "❌ $cmd is not installed. Run bootstrap.sh first."
    exit 1
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANSIBLE_DIR="$SCRIPT_DIR/ansible"
TERRAFORM_DIR="$SCRIPT_DIR/terraform"

# load env
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# handle vault password
VAULT_PASS_FILE="${1:-}"

if [ -n "$VAULT_PASS_FILE" ] && [ -f "$VAULT_PASS_FILE" ]; then
  # passed in from bootstrap.sh
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

# detect mode
MODE="${HANGAR_MODE:-local}"

if [ "$MODE" = "remote" ]; then
  echo "🌍 Remote mode — provisioning server with Terraform..."
  cd "$TERRAFORM_DIR"
  terraform init
  terraform plan \
    -var="hetzner_token=$HETZNER_TOKEN" \
    -var="ssh_key_name=$HETZNER_SSH_KEY_NAME"
  terraform apply \
    -var="hetzner_token=$HETZNER_TOKEN" \
    -var="ssh_key_name=$HETZNER_SSH_KEY_NAME" \
    -auto-approve

  SERVER_IP=$(terraform output -raw server_ip)
  cd "$SCRIPT_DIR"

  echo "⏳ Waiting for SSH on $SERVER_IP..."
  until ssh -o StrictHostKeyChecking=no root@$SERVER_IP "echo ready" 2>/dev/null; do
    sleep 5
  done

  cat > "$ANSIBLE_DIR/inventory.ini" << EOF
[hangar]
$SERVER_IP ansible_user=root
EOF

else
  echo "💻 Local mode — deploying to localhost..."
  cat > "$ANSIBLE_DIR/inventory.ini" << 'EOF'
[hangar]
localhost ansible_connection=local
EOF
fi

echo "⚙️  Running setup..."
ansible-playbook \
  -i "$ANSIBLE_DIR/inventory.ini" \
  "$ANSIBLE_DIR/playbooks/setup.yml" \
  --vault-password-file "$VAULT_PASS_FILE"

echo "🔐 Initializing Vault secrets..."
ansible-playbook \
  -i "$ANSIBLE_DIR/inventory.ini" \
  "$ANSIBLE_DIR/playbooks/vault-init.yml" \
  --vault-password-file "$VAULT_PASS_FILE"

echo "🚢 Deploying..."
ansible-playbook \
  -i "$ANSIBLE_DIR/inventory.ini" \
  "$ANSIBLE_DIR/playbooks/deploy.yml" \
  --vault-password-file "$VAULT_PASS_FILE"

echo "✅ Hangar is live!"
if [ "$MODE" = "remote" ]; then
  echo "🌐 http://$SERVER_IP"
else
  echo "🌐 http://localhost"
fi