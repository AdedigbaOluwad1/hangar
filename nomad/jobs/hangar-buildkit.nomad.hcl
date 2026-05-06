job "hangar-buildkit" {
  datacenters = ["dc1"]
  type        = "service"

  group "buildkit" {
    count = 1

    network {
      dns {
        servers = ["10.88.0.1"]
      }
      port "daemon" {
        static = 1234
        to     = 1234
      }
    }

    task "buildkit" {
      driver = "podman"

      config {
        image      = "docker.io/moby/buildkit:latest"
        privileged = true
        force_pull = false
        ports      = ["daemon"]
        args = [
          "--addr", "tcp://0.0.0.0:1234",
          "--oci-worker-snapshotter=overlayfs",
          "--config", "/etc/buildkit/buildkitd.toml",
        ]
        volumes = [
          "/etc/buildkit/buildkitd.toml:/etc/buildkit/buildkitd.toml",
          "/opt/hangar/data/buildkit:/var/lib/buildkit",
        ]
      }

      service {
        name         = "buildkit"
        port         = "daemon"
        address_mode = "driver"

        check {
          type         = "tcp"
          port         = "daemon"
          address_mode = "driver"
          interval     = "10s"
          timeout      = "2s"
        }
      }

      resources {
        cpu    = 1024
        memory = 1024
      }
    }
  }
}
