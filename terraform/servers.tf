data "openstack_images_image_v2" "ubuntu" {
  name        = "Ubuntu 22.04 LTS 64-bit"
  most_recent = true
}

# Публичный IP для VM с приложением
resource "openstack_networking_floatingip_v2" "app" {
  pool = "external-network"
}

# Публичный IP для VM с мониторингом
resource "openstack_networking_floatingip_v2" "monitoring" {
  pool = "external-network"
}

# VM с приложением
resource "openstack_compute_instance_v2" "app" {
  name            = "app-server"
  flavor_name     = var.app_flavor
  key_pair        = var.ssh_key_name
  security_groups = [openstack_networking_secgroup_v2.app.name]
  availability_zone = "ru-1b"

  block_device {
    uuid                  = data.openstack_images_image_v2.ubuntu.id
    source_type           = "image"
    volume_size           = 20
    boot_index            = 0
    destination_type      = "volume"
    delete_on_termination = true
    volume_type           = "fast.ru-1b"
  }

  network {
    uuid = openstack_networking_network_v2.network.id
  }
}

# VM с мониторингом
resource "openstack_compute_instance_v2" "monitoring" {
  name            = "monitoring-server"
  flavor_name     = var.monitoring_flavor
  key_pair        = var.ssh_key_name
  security_groups = [openstack_networking_secgroup_v2.monitoring.name]
  availability_zone = "ru-1b"

  block_device {
    uuid                  = data.openstack_images_image_v2.ubuntu.id
    source_type           = "image"
    volume_size           = 20
    boot_index            = 0
    destination_type      = "volume"
    delete_on_termination = true
    volume_type           = "fast.ru-1b"
  }

  network {
    uuid = openstack_networking_network_v2.network.id
  }
}

data "openstack_networking_port_v2" "app" {
  device_id  = openstack_compute_instance_v2.app.id
  network_id = openstack_networking_network_v2.network.id
}

data "openstack_networking_port_v2" "monitoring" {
  device_id  = openstack_compute_instance_v2.monitoring.id
  network_id = openstack_networking_network_v2.network.id
}

resource "openstack_networking_floatingip_associate_v2" "app" {
  floating_ip = openstack_networking_floatingip_v2.app.address
  port_id     = data.openstack_networking_port_v2.app.id
}

resource "openstack_networking_floatingip_associate_v2" "monitoring" {
  floating_ip = openstack_networking_floatingip_v2.monitoring.address
  port_id     = data.openstack_networking_port_v2.monitoring.id
}
