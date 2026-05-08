job "hangar-api" {
  datacenters = ["dc1"]
  type        = "service"

  group "api" {
    count = 1

    network {
      dns {
        servers = ["10.88.0.1"]
      }
      port "http" {
        static = 3001
        to     = 3001
      }
    }

    task "api" {
      driver = "podman"

      config {
        image      = "registry.service.consul:5000/hangar-api:latest"
        force_pull = true
        ports      = ["http"]
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
NOMAD_ADDR={{ .Data.data.nomad_addr }}
CONSUL_ADDR={{ .Data.data.consul_addr }}
NOMAD_TOKEN={{ .Data.data.nomad_token }}
{{- end }}
BUILDKIT_HOST=tcp://buildkit.service.consul:1234
REGISTRY_HOST=registry.service.consul:5000
DATABASE_URL=postgresql://hangar:hangar@postgres.service.consul:5432/hangar
REDIS_URL=redis://redis.service.consul:6379
EOT
        destination = "secrets/config.env"
        env         = true
        change_mode = "restart"
      }

      env {
        VAULT_ADDR        = "https://10.88.0.1:8200"
        CADDY_ADMIN_URL   = "http://caddy.service.consul:2019"
        VAULT_SKIP_VERIFY = "true"
      }

      resources {
        cpu    = 256
        memory = 512
      }

      service {
        name         = "api"
        port         = "http"
        address_mode = "driver"
        provider     = "consul"

        check {
          type         = "http"
          path         = "/health"
          interval     = "10s"
          timeout      = "3s"
          address_mode = "driver"
        }
      }
    }
  }
}