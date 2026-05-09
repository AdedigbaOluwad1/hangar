#!/bin/bash
set -e

echo "🚀 Bootstrapping Hangar..."

# ── Base dependencies ────────────────────────────────────────────────────────

if ! command -v curl &>/dev/null; then
  echo "Installing curl..."
  sudo apt-get update && sudo apt-get install -y curl
fi

if ! command -v git &>/dev/null; then
  echo "Installing git..."
  sudo apt-get update && sudo apt-get install -y git
fi

if ! command -v unzip &>/dev/null; then
  echo "Installing unzip..."
  sudo apt-get update && sudo apt-get install -y unzip
fi

if ! command -v jq &>/dev/null; then
  echo "Installing jq..."
  sudo apt-get update && sudo apt-get install -y jq
fi

if ! command -v ansible &>/dev/null; then
  echo "Installing ansible..."
  sudo apt-get update && sudo apt-get install -y ansible
fi

# ── Detect environment ───────────────────────────────────────────────────────

if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "🖥️  Detected WSL2 environment"
else
  echo "🖥️  Detected bare metal environment"
fi

# ── Clone or pull repo ───────────────────────────────────────────────────────

REPO_URL="${HANGAR_REPO_URL:-https://github.com/adedigbaoluwad1/hangar.git}"
DEST="${HOME}/documents/hangar"

if [ -d "$DEST/.git" ]; then
  echo "📦 Repo exists, pulling latest..."
  git -C "$DEST" pull
else
  echo "📦 Cloning repo..."
  mkdir -p "${HOME}/documents"
  git clone "$REPO_URL" "$DEST"
fi

cd "$DEST"

# ── Ansible collections ──────────────────────────────────────────────────────

echo "📦 Installing Ansible collections..."
ansible-galaxy collection install -r ansible/requirements.yml


# ── Hand off to deploy.sh ────────────────────────────────────────────────────

chmod +x deploy.sh
export HANGAR_REPO_URL="$REPO_URL"

VAULT_PASS_FILE="${1:-}"

if [ -n "$VAULT_PASS_FILE" ] && [ -f "$VAULT_PASS_FILE" ]; then
  : # already have it
elif [ -n "$ANSIBLE_VAULT_PASSWORD" ]; then
  VAULT_PASS_FILE="/tmp/.vault-pass"
  echo "$ANSIBLE_VAULT_PASSWORD" > "$VAULT_PASS_FILE"
  chmod 600 "$VAULT_PASS_FILE"
else
  read -s -p "🔐 Enter Ansible Vault password: " VAULT_PASS < /dev/tty
  echo
  VAULT_PASS_FILE="/tmp/.vault-pass"
  echo "$VAULT_PASS" > "$VAULT_PASS_FILE"
  chmod 600 "$VAULT_PASS_FILE"
  unset VAULT_PASS
fi

./deploy.sh "$VAULT_PASS_FILE"
