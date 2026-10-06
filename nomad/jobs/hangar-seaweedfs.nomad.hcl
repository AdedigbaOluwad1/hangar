job "hangar-seaweedfs" {
  datacenters = ["dc1"]
  type        = "service"

  group "seaweedfs" {
    count = 1

    network {
      dns {
        servers = ["10.88.0.1"]
      }
    }

    task "seaweedfs" {
      driver = "podman"

      config {
        image = "docker.io/chrislusf/seaweedfs:4.48"
        args = [
          "server",
          "-dir=/data",
          "-s3",
          "-s3.config=/etc/seaweedfs/s3.json",
          "-volume.max=20",
          "-master.volumeSizeLimitMB=256",
        ]
        volumes = [
          "/opt/hangar/data/seaweedfs:/data",
          "secrets/s3.json:/etc/seaweedfs/s3.json:ro",
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
{"identities":[
  {"name":"admin","credentials":[{"accessKey":"{{ .Data.data.s3_admin_access_key }}","secretKey":"{{ .Data.data.s3_admin_secret_key }}"}],"actions":["Admin","Read","Write","List","Tagging"]},
  {"name":"walg","credentials":[{"accessKey":"{{ .Data.data.walg_access_key }}","secretKey":"{{ .Data.data.walg_secret_key }}"}],"actions":["Read:hangar-backups","Write:hangar-backups","List:hangar-backups"]}
]}
{{- end }}
EOT
        destination = "secrets/s3.json"
        change_mode = "restart"
      }

      resources {
        cpu    = 300
        memory = 512
      }

      service {
        name         = "seaweedfs"
        port         = 8333
        address_mode = "driver"
        provider     = "consul"

        check {
          type         = "tcp"
          port         = 8333
          interval     = "10s"
          timeout      = "3s"
          address_mode = "driver"
        }
      }
    }
  }
}
