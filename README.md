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
- GITHUB_TOKEN (отдельный пароль от Github, создается в настройках)
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
- cAdvisor и node-exporter - Сбор статистики docker контейнеров и ресурсов системы соответственно

В каталоге "monitoring" находятся готовые стартовые конфиги для всех сервисов.

### Логи (Loki + Promtail)
- централизованный сбор логов
- контейнерные логи

### Алерты
В Prometheus были настроены базовые алерты и установлен alertmanager для сбора и отправки оповещений.
Была протестирована отправка оповещений по почте через smtp Yandex.

В конфиге monitoring/alertmanager/alertmanager.yml можно задать настройки отправки оповещений.

``` yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'mail.example.com:587' # SMTP сервер
  smtp_from: 'mail@example.com' # почта - от кого
  smtp_auth_username: 'mail@example.com' # имя пользователядля доступа к почтовому серверу
  smtp_auth_password: 'example_pass' # не пароль от почты, а пароль приложения для доступа
  smtp_require_tls: true
...
receivers:
  ...
    email_configs:
    - to: 'mail@example.com' # куда отправлять уведомления
      send_resolved: true
  # Ниже под каждым именем, такжже можно настроить отправку уведомлений
  - name: page
  - name: warning
  - name: critical
```

## Тестирование 
У веб приложения присутствуют базовые unit и integration тесты для примера и работы с ними.

---

## Какие навыки демонстрирует проект
- Docker / Docker Compose
- построение multi-service архитектуры
- CI/CD (GitHub Actions)
- мониторинг, observability, alerting
- логирование распределённых систем
- разделение dev / prod окружений
- reverse proxy конфигурация (Nginx)



