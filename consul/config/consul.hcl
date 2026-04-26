data_dir    = "/opt/consul/data"
log_level   = "INFO"
bind_addr   = "127.0.0.1"
client_addr = "0.0.0.0"

server           = true
bootstrap_expect = 1

ports {
  https = 8501
  http  = 8500  # keep HTTP for Nomad fingerprinting
}

tls {
  defaults {
    cert_file       = "/opt/consul/tls/consul.crt"
    key_file        = "/opt/consul/tls/consul.key"
    verify_incoming = false
    verify_outgoing = false

    # swap for Let's Encrypt:
    # cert_file = "/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
    # key_file  = "/etc/letsencrypt/live/yourdomain.com/privkey.pem"
  }
}

ui_config {
  enabled = true
}