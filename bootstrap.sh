#!/bin/bash
set -e

echo "🚀 Bootstrapping Hangar..."

# install curl if missing
if ! command -v curl &>/dev/null; then
  echo "Installing curl..."
  sudo apt-get update && sudo apt-get install -y curl
fi

# install git if missing
if ! command -v git &>/dev/null; then
  echo "Installing git..."
  sudo apt-get update && sudo apt-get install -y git
fi

# install unzip if missing
if ! command -v unzip &>/dev/null; then
  echo "Installing unzip..."
  sudo apt-get update && sudo apt-get install -y unzip
fi

# install ansible if missing
if ! command -v ansible &>/dev/null; then
  echo "Installing ansible..."
  sudo apt-get update && sudo apt-get install -y ansible
fi

# install terraform if missing
if ! command -v terraform &>/dev/null; then
  echo "Installing terraform..."
  TERRAFORM_VERSION="1.7.0"
  curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" -o /tmp/terraform.zip
  unzip -o /tmp/terraform.zip -d /tmp
  sudo mv /tmp/terraform /usr/local/bin/
  rm /tmp/terraform.zip
  echo "✅ Terraform $(terraform --version | head -1) installed"
fi

# clone or pull repo
REPO_URL="${HANGAR_REPO_URL:-https://github.com/your-username/hangar.git}"
DEST="${HOME}/documents/hangar"

if [ -d "$DEST/.git" ]; then
  echo "📦 Repo exists, pulling latest..."
  git -C "$DEST" pull
else
  echo "📦 Cloning repo..."
  git clone "$REPO_URL" "$DEST"
fi

# install ansible collections
echo "📦 Installing Ansible collections..."
ansible-galaxy collection install -r ansible/requirements.yml

# hand off to deploy.sh
cd "$DEST"
chmod +x deploy.sh
./deploy.sh