output "app_public_ip" {
  description = "Публичный IP VM с приложением"
  value       = openstack_networking_floatingip_v2.app.address
}

output "monitoring_public_ip" {
  description = "Публичный IP VM с мониторингом"
  value       = openstack_networking_floatingip_v2.monitoring.address
}

output "app_private_ip" {
  description = "Приватный IP VM с приложением (для связи между VM)"
  value       = openstack_compute_instance_v2.app.access_ip_v4
}

output "monitoring_private_ip" {
  description = "Приватный IP VM с мониторингом (для связи между VM)"
  value       = openstack_compute_instance_v2.monitoring.access_ip_v4
}

output "ssh_app" {
  description = "Команда для подключения к VM с приложением"
  value       = "ssh ubuntu@${openstack_networking_floatingip_v2.app.address}"
}

output "ssh_monitoring" {
  description = "Команда для подключения к VM с мониторингом"
  value       = "ssh ubuntu@${openstack_networking_floatingip_v2.monitoring.address}"
}


resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../ansible/inventory.yml"

  content = yamlencode({
    all = {
      hosts = {
        app = {
          ansible_host                 = openstack_networking_floatingip_v2.app.address
	  private_ip           = openstack_compute_instance_v2.app.access_ip_v4
          ansible_user                 = "root"
          ansible_ssh_private_key_file = "~/.ssh/id_ed25519"
        }
        monitoring = {
          ansible_host                 = openstack_networking_floatingip_v2.monitoring.address
	  private_ip           = openstack_compute_instance_v2.monitoring.access_ip_v4
          ansible_user                 = "root"
          ansible_ssh_private_key_file = "~/.ssh/id_ed25519"
        }
      }
    }
  })
}
