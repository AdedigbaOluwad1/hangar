storage "file" {
  path = "/opt/vault/data"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/opt/vault/tls/vault.crt"
  tls_key_file  = "/opt/vault/tls/vault.key"

  # swap for Let's Encrypt:
  # tls_cert_file = "/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
  # tls_key_file  = "/etc/letsencrypt/live/yourdomain.com/privkey.pem"
}

api_addr     = "http://127.0.0.1:8200"
log_level    = "INFO"
ui           = true
disable_mlock = true