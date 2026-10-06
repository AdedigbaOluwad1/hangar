job "hangar-postgres" {
  datacenters = ["dc1"]
  type        = "service"

  group "postgres" {
    count = 1

    network {
      dns {
        servers = ["10.88.0.1"]
      }
      port "db" {
        static = 5432
        to     = 5432
      }
    }

    task "postgres" {
      driver = "podman"

      config {
        image   = "docker.io/library/postgres:16-alpine"
        ports   = ["db"]
        volumes = ["/opt/hangar/data/postgres:/var/lib/postgresql/data"]
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
POSTGRES_PASSWORD={{ .Data.data.postgres_password }}
{{- end }}
EOT
        destination = "secrets/postgres.env"
        env         = true
        change_mode = "restart"
      }

      env {
        POSTGRES_USER = "hangar"
        POSTGRES_DB   = "hangar"
      }

      resources {
        cpu    = 256
        memory = 256
      }

      service {
        name         = "postgres"
        port         = "db"
        address_mode = "driver"
        provider     = "consul"

        check {
          type         = "tcp"
          port         = "db"
          interval     = "10s"
          timeout      = "3s"
          address_mode = "driver"
        }
      }
    }
  }
}