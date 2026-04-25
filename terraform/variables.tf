variable "hetzner_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "server_name" {
  description = "Name of the server"
  type        = string
  default     = "hangar-prod"
}

variable "server_type" {
  description = "Hetzner server type"
  type        = string
  default     = "cx22"  # 2 vCPU, 4GB RAM, €4.35/month
}

variable "location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "nbg1"  # Nuremberg, Germany
}

variable "ssh_key_name" {
  description = "Name of SSH key in Hetzner console"
  type        = string
}