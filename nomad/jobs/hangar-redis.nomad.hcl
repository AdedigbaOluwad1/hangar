job "hangar-redis" {
  datacenters = ["dc1"]
  type        = "service"

  group "redis" {
    count = 1

    network {
      dns {
        servers = ["10.88.0.1"]
      }
      port "db" {
        static = 6379
        to     = 6379
      }
    }

    task "redis" {
      driver = "podman"

      config {
        image   = "docker.io/library/redis:7-alpine"
        ports   = ["db"]
        args    = ["/etc/redis/redis.conf"]
        volumes = [
          "secrets/redis.conf:/etc/redis/redis.conf",
          "/opt/hangar/data/redis:/data",
        ]
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
appendonly yes
bind 0.0.0.0
{{- with secret "hangar/data/config" }}
requirepass {{ .Data.data.redis_password }}
{{- end }}
EOT
        destination = "secrets/redis.conf"
        change_mode = "restart"
      }

      resources {
        cpu    = 128
        memory = 128
      }

      service {
        name         = "redis"
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
