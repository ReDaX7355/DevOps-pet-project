terraform {
  required_providers {
    selectel = {
      source  = "selectel/selectel"
      version = "~> 7.1.0"
    }
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "~> 2.1.0"
    }
  }
}

provider "selectel" {
  domain_name = var.selectel_account
  username    = var.selectel_username
  password    = var.selectel_password
  auth_region = var.selectel_region
  auth_url    = "https://cloud.api.selcloud.ru/identity/v3/"
}

provider "openstack" {
  auth_url    = "https://cloud.api.selcloud.ru/identity/v3"
  domain_name = var.selectel_account
  user_name   = var.selectel_username
  password    = var.selectel_password
  tenant_id   = var.project_id
  region      = var.selectel_region
}
