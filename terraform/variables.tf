variable "selectel_account" {
  description = "Номер аккаунта Selectel (в правом верхнем углу панели управления)"
  type        = string
}

variable "selectel_username" {
  description = "Имя сервисного пользователя"
  type        = string
}

variable "selectel_password" {
  description = "Пароль сервисного пользователя"
  type        = string
  sensitive   = true
}

variable "selectel_region" {
  description = "Регион Selectel"
  type        = string
  default     = "ru-9"
}

variable "project_id" {
  description = "ID проекта в Selectel"
  type        = string
}

variable "ssh_key_name" {
  description = "Имя SSH ключа загруженного в Selectel"
  type        = string
}

variable "app_flavor" {
  description = "Тип VM для приложения (CPU/RAM)"
  type        = string
  default     = "BL1.1-2048"
}

variable "monitoring_flavor" {
  description = "Тип VM для мониторинга (CPU/RAM)"
  type        = string
  default     = "BL1.1-2048"
}

variable "allowed_ssh_ip" {
  description = "IP с которого разрешён SSH доступ к VM"
  type        = string
  default     = "0.0.0.0/0"  # потом заменишь на свой IP
}
