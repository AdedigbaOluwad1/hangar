job "hangar-registry" {
  datacenters = ["dc1"]
  type        = "service"
  group "registry" {
    count = 1
    network {
      dns {
        servers = ["10.88.0.1"]
      }
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
          "/opt/hangar/certs/registry/registry.crt:/certs/registry.crt:ro",
          "/opt/hangar/certs/registry/registry.key:/certs/registry.key:ro",
          "secrets/htpasswd:/auth/htpasswd:ro",
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
{{- with secret "hangar/data/config" -}}
{{ .Data.data.registry_htpasswd }}
{{- end }}
EOT
        destination = "secrets/htpasswd"
        change_mode = "restart"
      }
      env {
        REGISTRY_STORAGE_DELETE_ENABLED = "true"
        REGISTRY_HTTP_TLS_CERTIFICATE   = "/certs/registry.crt"
        REGISTRY_HTTP_TLS_KEY           = "/certs/registry.key"
        REGISTRY_AUTH                   = "htpasswd"
        REGISTRY_AUTH_HTPASSWD_REALM    = "Hangar Registry"
        REGISTRY_AUTH_HTPASSWD_PATH     = "/auth/htpasswd"
      }
      resources {
        cpu    = 128
        memory = 128
      }
      service {
        name         = "registry"
        port         = "http"
        address_mode = "driver"
        provider     = "consul"
        check {
          type         = "tcp"
          port         = "http"
          interval     = "10s"
          timeout      = "3s"
          address_mode = "driver"
        }
      }
    }
  }
}