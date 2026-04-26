storage "file" {
  path = "/tmp/vault/data"
}

listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = true
}

api_addr     = "http://127.0.0.1:8200"
log_level    = "INFO"
ui           = true
disable_mlock = true