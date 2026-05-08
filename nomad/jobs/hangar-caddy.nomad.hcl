job "hangar-caddy" {
  datacenters = ["dc1"]
  type        = "service"
  group "caddy" {
    count = 1
    network {
      dns {
        servers = ["10.88.0.1"]
      }
      port "http" {
        static = 80
        to     = 80
      }
      port "admin" {
        static = 2019
        to     = 2019
      }
    }
    task "caddy" {
      driver = "podman"
      config {
        image   = "docker.io/library/caddy:2-alpine"
        ports   = ["http", "admin"]
        volumes = [
          "local/Caddyfile:/etc/caddy/Caddyfile",
          "/opt/hangar/data/caddy:/data",
        ]
      }
      template {
        data = <<EOT
{
  admin 0.0.0.0:2019 {
    origins localhost:2019 ""
  }
}
:80 {
  handle /api/* {
    uri strip_prefix /api
    reverse_proxy {
      dynamic srv {
        name "api.service.consul"
        resolvers 10.88.0.1:8600
        refresh 5s
      }
    }
  }
  handle {
    reverse_proxy {
      dynamic srv {
        name "web.service.consul"
        resolvers 10.88.0.1:8600
        refresh 5s
      }
    }
  }
}
EOT
        destination = "local/Caddyfile"
        change_mode = "noop"
      }
      resources {
        cpu    = 128
        memory = 128
      }
      service {
        name         = "caddy"
        port         = "admin"
        address_mode = "driver"
        provider     = "consul"
        check {
          type         = "tcp"
          port         = "admin"
          interval     = "10s"
          timeout      = "3s"
          address_mode = "driver"
        }
      }
    }
  }
}