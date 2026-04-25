job "hangar-{{DEPLOYMENT_ID}}" {
  datacenters = ["dc1"]
  type        = "service"

  group "app" {
    count = 1

    network {
      port "http" {
        to = 3000
      }
    }

    task "web" {
      driver = "docker"

      config {
        image = "hangar-{{IMAGE_TAG}}"
        ports = ["http"]
        force_pull = false
      }

      env {
        PORT = "3000"
      }

      resources {
        cpu    = 500
        memory = 512
      }

      service {
        name = "hangar-{{DEPLOYMENT_ID}}"
        port = "http"

        check {
          type     = "http"
          path     = "/"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}