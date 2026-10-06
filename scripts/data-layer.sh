REGISTRY_IMAGE_HOST="registry.service.consul:5000"
POSTGRES_IMAGE="$REGISTRY_IMAGE_HOST/hangar-postgres:16"
BACKUP_BUCKET="hangar-backups"

vault_get() {
  VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true \
    VAULT_TOKEN="$(sudo cat /etc/vault.d/keys/init.json | jq -r '.root_token')" \
    vault kv get -field="$1" hangar/config
}

sync_postgres_password() {
  local pw container
  pw=$(vault_get postgres_password)
  container=$(sudo podman ps -q --filter name=postgres | head -1)
  echo "ALTER USER hangar PASSWORD '$pw'" | \
    sudo podman exec -i "$container" psql -U hangar -d hangar -v ON_ERROR_STOP=1 -q
  echo "✅ Postgres password matches Vault"
}

build_postgres_image() {
  echo "🐘 Building $POSTGRES_IMAGE (Postgres + WAL-G)..."
  sudo podman build -q -t "$POSTGRES_IMAGE" "$SCRIPT_DIR/postgres" > /dev/null
  sudo podman push "$POSTGRES_IMAGE"
}

ensure_backup_bucket() {
  local addr url
  addr=$(getent hosts seaweedfs.service.consul | awk '{print $1}' | head -1)
  url="http://$addr:8333/$BACKUP_BUCKET"
  s3_curl() {
    printf 'user = "%s:%s"\n' "$(vault_get s3_admin_access_key)" "$(vault_get s3_admin_secret_key)" | \
      curl -s -o /dev/null -w "%{http_code}" -K - --aws-sigv4 "aws:amz:us-east-1:s3" "$@"
  }
  if [ "$(s3_curl -I "$url")" != "200" ]; then
    [ "$(s3_curl -X PUT "$url")" = "200" ] || { echo "❌ Could not create bucket $BACKUP_BUCKET"; exit 1; }
  fi
  echo "✅ Bucket $BACKUP_BUCKET ready"
}

force_first_backup() {
  nomad job periodic force hangar-postgres-backup > /dev/null
  echo "✅ Base backup started"
}
