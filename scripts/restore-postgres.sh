#!/bin/bash
set -euo pipefail

usage() {
  echo "usage: $0 <empty-data-dir> [latest|<recovery-target-time>]"
  echo "  Restores the newest base backup from the backup bucket into <empty-data-dir> and"
  echo "  configures WAL replay, either to the end of the archive (latest) or to a UTC time"
  echo "  such as '2026-10-06 08:31:00+00'. Start Postgres on the directory afterwards."
  exit 1
}

[ $# -ge 1 ] || usage
DATA_DIR="$1"
TARGET="${2:-latest}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/scripts/data-layer.sh"

if [ -e "$DATA_DIR" ] && [ -n "$(sudo ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  echo "❌ $DATA_DIR is not empty. Restore only into a fresh directory."
  exit 1
fi

sudo mkdir -p "$DATA_DIR"
sudo chown 70:70 "$DATA_DIR"
sudo chmod 700 "$DATA_DIR"

walg() {
  sudo podman run --rm --user 70 \
    -e WALG_S3_PREFIX="s3://$BACKUP_BUCKET/postgres" \
    -e AWS_ENDPOINT="http://seaweedfs.service.consul:8333" \
    -e AWS_S3_FORCE_PATH_STYLE=true \
    -e AWS_REGION=us-east-1 \
    -e AWS_ACCESS_KEY_ID="$(vault_get walg_access_key)" \
    -e AWS_SECRET_ACCESS_KEY="$(vault_get walg_secret_key)" \
    -v "$DATA_DIR:/var/lib/postgresql/data" \
    --entrypoint wal-g "$POSTGRES_IMAGE" "$@"
}

echo "⬇️  Fetching the latest base backup..."
walg backup-fetch /var/lib/postgresql/data LATEST

{
  echo "restore_command = 'wal-g wal-fetch \"%f\" \"%p\"'"
  if [ "$TARGET" != "latest" ]; then
    echo "recovery_target_time = '$TARGET'"
    echo "recovery_target_action = 'promote'"
  fi
} | sudo tee -a "$DATA_DIR/postgresql.auto.conf" > /dev/null
sudo touch "$DATA_DIR/recovery.signal"
sudo chown 70:70 "$DATA_DIR/recovery.signal" "$DATA_DIR/postgresql.auto.conf"

echo "✅ Restored into $DATA_DIR (recovery target: $TARGET)"
