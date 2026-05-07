job "hangar-registry" {
  datacenters = ["dc1"]
  type        = "system"

  group "registry" {
    count = 1

    network {
      port "http" {
        static = 5000
        to     = 5000
      }
    }

    task "registry" {
      driver = "podman"

      config {
        image = "docker.io/library/registry:2"
        ports = ["http"]
        volumes = [
          "/opt/hangar/data/registry:/var/lib/registry",
        ]
      }

      env {
        REGISTRY_STORAGE_DELETE_ENABLED = "true"
      }

      resources {
        cpu    = 128
        memory = 128
      }

      service {
        name         = "registry"
        port         = "http"
        address_mode = "host"
        provider     = "consul"

        check {
          type         = "http"
          path         = "/v2/"
          interval     = "10s"
          timeout      = "3s"
          address_mode = "host"
        }
      }
    }
  }
}