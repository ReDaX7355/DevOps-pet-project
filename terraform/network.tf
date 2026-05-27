#Создание приватной сети
resource "openstack_networking_network_v2" "network" {
  name           = "private-network"
  admin_state_up = true
}

#Создание локальной подсети для VM
resource "openstack_networking_subnet_v2" "subnet" {
  name            = "private-subnet"
  network_id      = openstack_networking_network_v2.network.id
  cidr            = "192.168.10.0/24"
  ip_version      = 4
  dns_nameservers = ["8.8.8.8", "8.8.4.4"]
}

#Создание роутера
resource "openstack_networking_router_v2" "router" {
  name                = "router"
  external_network_id = "ab2264dd-bde8-4a97-b0da-5fea63191019"
}

#Настройка роутера
resource "openstack_networking_router_interface_v2" "router_interface" {
  router_id = openstack_networking_router_v2.router.id
  subnet_id = openstack_networking_subnet_v2.subnet.id
}


# Security group для VM с приложением
resource "openstack_networking_secgroup_v2" "app" {
  name = "app-secgroup"
}

# SSH доступ
resource "openstack_networking_secgroup_rule_v2" "app_ssh" {
  security_group_id = openstack_networking_secgroup_v2.app.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = var.allowed_ssh_ip
}

# HTTP для приложения
resource "openstack_networking_secgroup_rule_v2" "app_http" {
  security_group_id = openstack_networking_secgroup_v2.app.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 80
  port_range_max    = 80
  remote_ip_prefix  = "0.0.0.0/0"
}

# HTTPS для приложения
resource "openstack_networking_secgroup_rule_v2" "app_https" {
  security_group_id = openstack_networking_secgroup_v2.app.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 443
  port_range_max    = 443
  remote_ip_prefix  = "0.0.0.0/0"
}

# Security group для VM с мониторингом
resource "openstack_networking_secgroup_v2" "monitoring" {
  name = "monitoring-secgroup"
}

# SSH доступ
resource "openstack_networking_secgroup_rule_v2" "monitoring_ssh" {
  security_group_id = openstack_networking_secgroup_v2.monitoring.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
}

# Grafana
resource "openstack_networking_secgroup_rule_v2" "monitoring_grafana" {
  security_group_id = openstack_networking_secgroup_v2.monitoring.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 3000
  port_range_max    = 3000
  remote_ip_prefix  = "0.0.0.0/0"
}

# Prometheus
resource "openstack_networking_secgroup_rule_v2" "monitoring_prometheus" {
  security_group_id = openstack_networking_secgroup_v2.monitoring.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 9090
  port_range_max    = 9090
  remote_ip_prefix  = "0.0.0.0/0"
}
