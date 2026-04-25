terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

provider "hcloud" {
  token = var.hetzner_token
}

# SSH key — must already exist in Hetzner console
data "hcloud_ssh_key" "default" {
  name = var.ssh_key_name
}

# firewall
resource "hcloud_firewall" "hangar" {
  name = "${var.server_name}-firewall"

  # allow SSH
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # allow HTTP
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # allow HTTPS
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # allow Caddy admin — internal only in prod, locked down here
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "2019"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

# the server
resource "hcloud_server" "hangar" {
  name        = var.server_name
  image       = "ubuntu-24.04"
  server_type = var.server_type
  location    = var.location
  ssh_keys    = [data.hcloud_ssh_key.default.id]

  firewall_ids = [hcloud_firewall.hangar.id]

  # cloud-init — runs on first boot
  user_data = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y curl git
  EOF

  labels = {
    project = "hangar"
    env     = "prod"
  }
}

# persistent volume for Docker data
resource "hcloud_volume" "hangar_data" {
  name      = "${var.server_name}-data"
  size      = 50  # 50GB
  location  = var.location
  format    = "ext4"
}

# attach volume to server
resource "hcloud_volume_attachment" "hangar_data" {
  volume_id = hcloud_volume.hangar_data.id
  server_id = hcloud_server.hangar.id
  automount = true
}