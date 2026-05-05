job "hangar-web" {
  datacenters = ["dc1"]
  type        = "service"

  group "web" {
    count = 1

    network {
      port "http" {
        static = 5173
        to     = 5173
      }
    }

    task "web" {
      driver = "podman"

      config {
        image = "localhost:5000/hangar-web:latest"
        ports = ["http"]
      }

      resources {
        cpu    = 256
        memory = 512
      }

      service {
        name         = "web"
        port         = "http"
        address_mode = "driver"
        provider     = "consul"

        check {
          type         = "http"
          path         = "/"
          interval     = "10s"
          timeout      = "3s"
          address_mode = "driver"
        }
      }
    }
  }
}