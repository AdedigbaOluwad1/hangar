job "hangar-postgres" {
  datacenters = ["dc1"]
  type        = "service"

  group "postgres" {
    count = 1

    network {
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

      env {
        POSTGRES_USER     = "hangar"
        POSTGRES_PASSWORD = "hangar"
        POSTGRES_DB       = "hangar"
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
          type         = "script"
          command      = "pg_isready"
          args         = ["-U", "hangar"]
          interval     = "10s"
          timeout      = "3s"
          address_mode = "driver"
        }
      }
    }
  }
}