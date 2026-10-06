job "hangar-postgres-backup" {
  datacenters = ["dc1"]
  type        = "batch"

  periodic {
    crons            = ["0 2 * * *"]
    prohibit_overlap = true
  }

  group "backup" {
    count = 1

    network {
      dns {
        servers = ["10.88.0.1"]
      }
    }

    task "backup" {
      driver = "podman"
      user   = "70"

      config {
        image   = "registry.service.consul:5000/hangar-postgres:16"
        command = "/bin/sh"
        args = [
          "-c",
          "wal-g backup-push /var/lib/postgresql/data && wal-g delete before FIND_FULL \"$(date -u -d @$(( $(date +%s) - 14 * 86400 )) +%Y-%m-%dT%H:%M:%SZ)\" --confirm && wal-g backup-list",
        ]
        volumes = ["/opt/hangar/data/postgres:/var/lib/postgresql/data:ro"]
      }

      identity {
        name = "vault_default"
        aud  = ["vault.io"]
        file = true
        ttl  = "1h"
      }

      vault {
        role = "nomad-workloads"
      }

      template {
        data        = <<EOT
{{- with secret "hangar/data/config" -}}
PGPASSWORD={{ .Data.data.postgres_password }}
AWS_ACCESS_KEY_ID={{ .Data.data.walg_access_key }}
AWS_SECRET_ACCESS_KEY={{ .Data.data.walg_secret_key }}
{{- end }}
EOT
        destination = "secrets/backup.env"
        env         = true
      }

      env {
        PGHOST                  = "postgres.service.consul"
        PGPORT                  = "5432"
        PGUSER                  = "hangar"
        PGDATABASE              = "hangar"
        WALG_S3_PREFIX          = "s3://hangar-backups/postgres"
        AWS_ENDPOINT            = "http://seaweedfs.service.consul:8333"
        AWS_S3_FORCE_PATH_STYLE = "true"
        AWS_REGION              = "us-east-1"
      }

      resources {
        cpu    = 256
        memory = 256
      }
    }
  }
}
