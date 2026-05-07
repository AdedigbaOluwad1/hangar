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

read -s -p "🔐 Enter Ansible Vault password: " VAULT_PASS < /dev/tty
echo
echo "$VAULT_PASS" > /tmp/.vault-pass
chmod 600 /tmp/.vault-pass
unset VAULT_PASS

./deploy.sh /tmp/.vault-pass