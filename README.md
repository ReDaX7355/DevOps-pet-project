# DevOps Pet Project — Full-Stack инфраструктура с CI/CD и мониторингом

### Описание проекта
Проект создан как практическая DevOps-лаборатория для отработки инфраструктурных навыков, приближённых к production-среде.
Он предназначен для демонстрации навыков, полученных путем изучения методологии DevOps в системном администрировании и показывает полный DevOps-пайплайн для веб-приложения:

- контейнеризация веб-приложения (frontend и backend)
- оркестрация через Docker Compose
- CI/CD через GitHub Actions
- reverse proxy (Nginx)
- система мониторинга и логирования
- разделение окружений (dev / prod)

Цель — показать практическое понимание DevOps-подхода в условиях, приближенных к production.

## Архитектура
Компоненты системы:

- Frontend — пользовательский интерфейс
- Backend — REST API
- PostgreSQL — база данных
- Nginx — reverse proxy
- Prometheus — сбор метрик
- Grafana — визуализация метрик
- Loki + Promtail — логирование
- cAdvisor — метрики контейнеров
- node-exporter — метрики сервера

## Требования
- Docker ≥ 24
- Docker Compose ≥ 2
- Git

## Бысрый старт
1. Клонирование проекта
```sh
git clone https://github.com/ReDaX7355/DevOps-pet-project.git
cd DevOps-pet-project
```

2. Настройка переменных окружения
```sh
cp .env.example .env
```

3. Запуск проекта

Сначала запускаем само веб приложение
```sh
docker compose -f docker-compose.dev.yml up -d --build
```
Затем мониторинг
```sh
docker compose -f ./monitoring/docker-compose.yml up -d
```

После запуска сервисы будут доступны:
| Сервис | Адрес |
|--|--|
| Frontend | http://localhost:80 |
| Backend API | http://localhost:80/api/ |
| Grafana | http://localhost:3000 |
| Prometheus | http://localhost:9090 |


## CI/CD (GitHub Actions)
Один из Pipeline запускается при push в dev для тестирования, создания образов и пуша их в GHCR.
Второй при push в main, создает образы и деплоит на сервер (работает только с удаленным сервером).

Требуемые SECRETS для dev:
- POSTGRES_DB
- POSTGRES_USER
- POSTGRES_PASSWORD
- DATABASE_URL
- PORT_BACKEND

Для prod:
- GITHUB_TOKEN (пароль от Github)
- SERVER_HOST
- SSH_PRIVATE_KEY
- SERVER_USER

## Мониторинг и логирование

### Метрики (Prometheus + Grafana)
В Grafana по умолчанию идет два готовых дашборда, для отслеживания состояние сервера и Docker контейнеров.

Отслеживаются:
- загрузка CPU / RAM контейнеров
- состояние сервисов
- HTTP-запросы
- uptime сервисов и др.

#### Стек мониторинга
- Prometheus - основное хранилище метрик
- Promtail - чтение и сбор логов системы
- Loki - хранение системных логов и их отображение
- Grafana - вывод метрик в графики и дашборды
- cAdvisor и node-exporter - Сбор статистики docker контейнеров и ресурсов системы

### Логи (Loki + Promtail)
- централизованный сбор логов
- контейнерные логи

### Алерты
Также в Prometheus были настроены базовые алерты и установлен alertmanager для сбора и отправки оповещений.

## Тестирование 
У веб приложения присутствуют базовые тесты для примера.

---

## Какие навыки демонстрирует проект
- Docker / Docker Compose
- построение multi-service архитектуры
- CI/CD (GitHub Actions)
- мониторинг, observability, alerting
- логирование распределённых систем
- разделение dev / prod окружений
- reverse proxy конфигурация (Nginx)



