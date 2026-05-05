job "hangar-api" {
  datacenters = ["dc1"]
  type        = "service"

  group "api" {
    count = 1

    network {
      port "http" {
        static = 3001
        to     = 3001
      }
    }

    task "api" {
      driver = "podman"

      config {
        image = "localhost:5000/hangar-api:latest"
        ports = ["http"]
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
        data        = <<-EOT
          {{- with secret "hangar/data/config" -}}
          BUILDKIT_HOST={{ .Data.data.buildkit_host }}
          CADDY_ADMIN_URL={{ .Data.data.caddy_admin_url }}
          NOMAD_ADDR={{ .Data.data.nomad_addr }}
          CONSUL_ADDR={{ .Data.data.consul_addr }}
          {{- end }}
          {{- range service "postgres" }}
          DATABASE_URL=postgresql://hangar:hangar@{{ .Address }}:{{ .Port }}/hangar
          {{- end }}
          {{- range service "redis" }}
          REDIS_URL=redis://{{ .Address }}:{{ .Port }}
          {{- end }}
        EOT
        destination = "secrets/config.env"
        env         = true
      }

      env {
        VAULT_ADDR        = "https://10.88.0.1:8200"
        VAULT_SKIP_VERIFY = "true"
      }

      resources {
        cpu    = 256
        memory = 512
      }
    }
  }
}