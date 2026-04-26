data_dir  = "/opt/nomad/data"
log_level = "INFO"
bind_addr = "0.0.0.0"

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
  enabled = true
  options = {
    "driver.whitelist" = "docker"
  }
  host_volume "docker_sock" {
    path      = "/var/run/docker.sock"
    read_only = false
  }
}

plugin "docker" {
  config {
    allow_privileged = true
    allow_caps       = ["ALL"]
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