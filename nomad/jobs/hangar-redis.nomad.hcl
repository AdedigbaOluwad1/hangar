job "hangar-redis" {
  datacenters = ["dc1"]
  type        = "service"

  group "redis" {
    count = 1

    network {
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
        args    = ["--appendonly", "yes", "--bind", "0.0.0.0"]
        volumes = ["/opt/hangar/data/redis:/data"]
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
          type         = "script"
          command      = "redis-cli"
          args         = ["ping"]
          interval     = "10s"
          timeout      = "3s"
          address_mode = "driver"
        }
      }
    }
  }
}