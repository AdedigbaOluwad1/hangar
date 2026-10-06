# Restore Postgres from backup

Postgres archives every WAL segment to the `hangar-backups` bucket (SeaweedFS in the sandbox, Object Storage in production) with WAL-G, and `hangar-postgres-backup` takes a full base backup nightly at 02:00 UTC. Backups older than 14 days are pruned after each run. `archive_timeout=60` forces a segment out at least every minute, so a restore loses at most about a minute of writes.

Drilled on 2026-10-06 against the sandbox: a point-in-time restore returned only the rows written before the target time, and a latest restore returned every row, including one written less than a minute before the simulated failure.

## Check that backups are healthy

```bash
export SCRIPT_DIR=$PWD; source scripts/data-layer.sh

sudo podman exec $(sudo podman ps -q --filter name=postgres | head -1) \
  psql -U hangar -d hangar -c "select archived_count, failed_count, last_archived_wal, last_failed_wal from pg_stat_archiver"

sudo podman run --rm --user 70 --entrypoint wal-g \
  -e WALG_S3_PREFIX=s3://hangar-backups/postgres -e AWS_ENDPOINT=http://seaweedfs.service.consul:8333 \
  -e AWS_S3_FORCE_PATH_STYLE=true -e AWS_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID="$(vault_get walg_access_key)" -e AWS_SECRET_ACCESS_KEY="$(vault_get walg_secret_key)" \
  "$POSTGRES_IMAGE" backup-list
```

`failed_count` should stay flat. If the bucket is unreachable, WAL piles up in `pg_wal` on the data volume until archiving catches up, so fix the store before the disk fills.

Take a base backup now with `nomad job periodic force hangar-postgres-backup`.

## Restore onto a fresh data directory

Use a new node, or move the old directory aside first. The script refuses a non-empty directory.

```bash
export NOMAD_TOKEN=$(sudo cat /etc/nomad.d/operator.json | jq -r .SecretID)
export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=$(sudo cat /etc/vault.d/keys/init.json | jq -r .root_token)

nomad job stop hangar-postgres
sudo mv /opt/hangar/data/postgres /opt/hangar/data/postgres.broken

scripts/restore-postgres.sh /opt/hangar/data/postgres latest
```

To stop at a moment before something went wrong, pass a UTC time instead of `latest`:

```bash
scripts/restore-postgres.sh /opt/hangar/data/postgres '2026-10-06 08:30:41+00'
```

The script fetches the newest base backup, writes `restore_command` and the recovery target into `postgresql.auto.conf`, and creates `recovery.signal`. The target must fall after the base backup was taken and before the last archived WAL.

## Bring the database back

```bash
nomad job run nomad/jobs/hangar-postgres.nomad.hcl
export SCRIPT_DIR=$PWD; source scripts/data-layer.sh
sync_postgres_password
```

Postgres replays WAL from the bucket on start, promotes itself when it reaches the target (or the end of the archive), and carries on archiving on a new timeline. Check the data, then force a fresh base backup so the new timeline has one:

```bash
nomad job periodic force hangar-postgres-backup
```

Keep `postgres.broken` until you are sure the restored data is right.

## Rehearse it

Restore into a scratch directory and start a throwaway container on it instead of replacing the live data:

```bash
scripts/restore-postgres.sh /opt/hangar/restore-drill latest
sudo podman run -d --name drill-pg --user 70 -v /opt/hangar/restore-drill:/var/lib/postgresql/data \
  -e WALG_S3_PREFIX=s3://hangar-backups/postgres -e AWS_ENDPOINT=http://seaweedfs.service.consul:8333 \
  -e AWS_S3_FORCE_PATH_STYLE=true -e AWS_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID="$(vault_get walg_access_key)" -e AWS_SECRET_ACCESS_KEY="$(vault_get walg_secret_key)" \
  "$POSTGRES_IMAGE"
sudo podman exec drill-pg psql -U hangar -d hangar -c "select count(*) from deployments"
sudo podman rm -f drill-pg && sudo rm -rf /opt/hangar/restore-drill
```

Wait until `select pg_is_in_recovery()` returns `f` before querying.
