data_dir  = "/opt/nomad/data"
plugin_dir = "/opt/nomad/plugins"
log_level = "INFO"
bind_addr = "0.0.0.0"

acl {
  enabled = true
}

advertise {
  http = "127.0.0.1"
  rpc  = "127.0.0.1"
  serf = "127.0.0.1"
}

server {
  enabled          = true
  bootstrap_expect = 1
}

client {
  enabled    = true

  host_volume "postgres-data" {
    path      = "/opt/hangar/data/postgres"
    read_only = false
  }

  host_volume "redis-data" {
    path      = "/opt/hangar/data/redis"
    read_only = false
  }
}

plugin "nomad-driver-podman" {
  config {
    socket_path = "unix:///run/podman/podman.sock"
    volumes {
      enabled = true
    }
  }
}

consul {
  address    = "127.0.0.1:8500"
  scheme     = "http"
  verify_ssl = false
}

vault {
  enabled               = true
  address               = "https://127.0.0.1:8200"
  tls_skip_verify       = true
  jwt_auth_backend_path = "jwt-nomad"

  default_identity {
    aud = ["vault.io"]
    ttl = "1h"
  }
}
