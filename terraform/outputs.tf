output "server_ip" {
  description = "Public IP of the Hangar server"
  value       = hcloud_server.hangar.ipv4_address
}

output "server_id" {
  description = "Hetzner server ID"
  value       = hcloud_server.hangar.id
}

output "volume_id" {
  description = "Data volume ID"
  value       = hcloud_volume.hangar_data.id
}