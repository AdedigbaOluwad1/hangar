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

# detect mode
MODE="${HANGAR_MODE:-local}"

if [ "$MODE" = "remote" ]; then
  echo "🌍 Remote mode — provisioning server with Terraform..."

  # init terraform
  cd "$TERRAFORM_DIR"
  terraform init

  # plan
  terraform plan \
    -var="hetzner_token=$HETZNER_TOKEN" \
    -var="ssh_key_name=$HETZNER_SSH_KEY_NAME"

  # apply
  terraform apply \
    -var="hetzner_token=$HETZNER_TOKEN" \
    -var="ssh_key_name=$HETZNER_SSH_KEY_NAME" \
    -auto-approve

  SERVER_IP=$(terraform output -raw server_ip)
  cd "$SCRIPT_DIR"

  # wait for SSH
  echo "⏳ Waiting for SSH on $SERVER_IP..."
  until ssh -o StrictHostKeyChecking=no root@$SERVER_IP "echo ready" 2>/dev/null; do
    sleep 5
  done

  # generate remote inventory
  cat > "$ANSIBLE_DIR/inventory.ini" << EOF
[hangar]
$SERVER_IP ansible_user=root
EOF

else
  echo "💻 Local mode — deploying to localhost..."

  # use local inventory
  cat > "$ANSIBLE_DIR/inventory.ini" << 'EOF'
[hangar]
localhost ansible_connection=local
EOF

fi

# 1. setup machine
echo "⚙️  Running setup..."
ansible-playbook -i "$ANSIBLE_DIR/inventory.ini" "$ANSIBLE_DIR/playbooks/setup.yml"

# 2. deploy app
echo "🚢 Deploying..."
ansible-playbook -i "$ANSIBLE_DIR/inventory.ini" "$ANSIBLE_DIR/playbooks/deploy.yml"

echo "✅ Hangar is live!"
if [ "$MODE" = "remote" ]; then
  echo "🌐 http://$SERVER_IP"
else
  echo "🌐 http://localhost"
fi