# Kubernetes — локальный кластер

Эта ветка содержит миграцию проекта с Docker Compose на Kubernetes.
Локальный кластер поднят через **minikube** на отдельной VM (Ubuntu, VMware).

Стек приложения (Node.js backend, React frontend, PostgreSQL) полностью перенесён в Kubernetes с сохранением архитектуры: единая точка входа, изоляция сети, персистентное хранилище для базы данных.

## Архитектура

```
                    Ingress (nginx)
                    /            \
              path: /api      path: /
                    |            |
                 backend <--- frontend
                    |        (2 реплики)
               postgres-db
                    |
          PersistentVolumeClaim
```

Всё развёрнуто в отдельном namespace `todo-app`, изолированном от
служебных ресурсов кластера (`default`, `ingress-nginx`).

## Требования

- kubectl
- minikube (драйвер `docker`)
- Docker

## Быстрый старт

```bash
# Запустить локальный кластер
minikube start --driver=docker

# Включить Ingress controller
minikube addons enable ingress

# Применить манифесты по порядку
kubectl apply -f namespace.yml
kubectl apply -f postgres-secret.yml
kubectl apply -f backend-configmap.yml
kubectl apply -f postgres.yml
kubectl apply -f backend.yml
kubectl apply -f frontend.yml
kubectl apply -f ingress.yml

# Проверить статус
kubectl get pods -n todo-app
```

## Доступ к приложению

Через порт-форвард на Ingress controller (проще всего для локального теста):

```bash
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80 --address 0.0.0.0
```

Приложение доступно по адресу `http://<IP_VM>:8080`.

## Что реализовано

### Deployment вместо голого Pod
Все компоненты (backend, frontend, postgres) развёрнуты через `Deployment`,
а не как отдельные `Pod`. Это даёт самовосстановление — если Pod падает,
Deployment автоматически создаёт новый взамен. Голый Pod такой возможности
не имеет.

### Service — постоянный адрес для Pod'ов
Каждый компонент имеет `Service`, который даёт статичное DNS-имя
(`backend`, `frontend`, `postgres-db`) независимо от того, что реальные
Pod'ы пересоздаются и меняют IP.

### PersistentVolumeClaim — хранилище для Postgres
Данные базы данных хранятся в `PersistentVolumeClaim`, что позволяет
пережить пересоздание Pod'а без потери данных (аналог volume в Docker Compose).

### Ingress — единая точка входа
Заменяет nginx reverse proxy из Docker Compose. Маршрутизация настроена так же:
- `/api` → backend (порт 5000)
- `/` → frontend (порт 80)

### ConfigMap и Secret — конфигурация отдельно от кода
- `ConfigMap` — для не чувствительных настроек (например `PORT`)
- `Secret` — для паролей и строк подключения к базе данных
  (хранится в base64, подключается к Pod через `secretKeyRef`)

### Resources — лимиты ресурсов
Для backend и frontend заданы `requests` и `limits` по CPU и памяти,
чтобы один компонент не мог захватить все ресурсы узла.

### Health checks — самодиагностика
- **Backend**: `livenessProbe` и `readinessProbe` через HTTP GET на `/health`
- **Postgres**: проверка через `pg_isready` (exec-команда)

Если проверка проваливается — Kubernetes либо перезапускает контейнер
(liveness), либо временно убирает его из балансировки трафика (readiness).

### Namespace — изоляция
Всё приложение развёрнуто в отдельном namespace `todo-app`, а не в `default`.
Это стандартная практика — разделяет ресурсы проекта от служебных
(`ingress-nginx`, `kube-system`) и других приложений в кластере.

## Структура манифестов

| Файл | Объекты |
|---|---|
| `namespace.yml` | Namespace `todo-app` |
| `postgres-secret.yml` | Secret с паролями и строкой подключения |
| `backend-configmap.yml` | ConfigMap с переменными backend |
| `postgres.yml` | PVC, Deployment, Service для PostgreSQL |
| `backend.yml` | Deployment, Service backend с probes и лимитами |
| `frontend.yml` | Deployment, Service frontend (2 реплики) |
| `ingress.yml` | Ingress с маршрутизацией `/api` и `/` |

## Полезные команды

```bash
# Проверить состояние всех ресурсов в namespace
kubectl get all -n todo-app

# Логи конкретного Pod'а
kubectl logs <pod-name> -n todo-app

# Проверить самовосстановление
kubectl delete pod <pod-name> -n todo-app
kubectl get pods -n todo-app   # Deployment создаст новый Pod автоматически

# Проверить лимиты ресурсов на Pod'е
kubectl describe pod <pod-name> -n todo-app | grep -A 6 "Limits\|Requests"

# Проверить конфигурацию Ingress
kubectl get ingress -n todo-app -o yaml
```

## В планах

- [ ] Перенос стека мониторинга (Prometheus, Grafana, Loki) в Kubernetes
- [ ] Упаковка манифестов в Helm chart
- [ ] StatefulSet для PostgreSQL вместо Deployment
- [ ] Разворачивание в managed Kubernetes (например Selectel Managed Kubernetes)
