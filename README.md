# Kubernetes — локальный кластер (ветка k8s)

Эта ветка содержит миграцию проекта с Docker Compose на Kubernetes.
Локальный кластер поднят через **minikube** на отдельной VM (Ubuntu, VMware).

Стек приложения (Node.js backend, React frontend, PostgreSQL) и стек
мониторинга (Prometheus, Grafana, Loki, Alertmanager) полностью перенесены
в Kubernetes с сохранением архитектуры: единая точка входа, изоляция сети,
персистентное хранилище, физическое разделение приложения и мониторинга
по разным нодам кластера — как раньше было на двух отдельных VM.

## Требования

- kubectl
- minikube (драйвер `docker`, **2 ноды**)
- Helm
- Docker

## Архитектура кластера

Кластер состоит из **двух нод**, помеченных по ролям — приложение и
мониторинг физически разнесены, аналогично тому, как раньше было
на двух отдельных VM в Selectel:

```
Кластер (minikube, 2 ноды)
├── Node "minikube"    (role=app)
│     └── namespace todo-app: backend, frontend, postgres
└── Node "minikube-m02" (role=monitoring)
      └── namespace monitoring: prometheus, grafana, loki, alertmanager
```

Компоненты закрепляются за нужной нодой через `nodeSelector`. Исключение —
`promtail` и `node-exporter`, которые развёрнуты как `DaemonSet` и работают
на **обеих** нодах одновременно, чтобы собирать логи и метрики отовсюду,
включая ноду с приложением.

### Приложение (`todo-app-chart`)

```
                    Ingress (nginx)
                    /            \
              path: /api      path: /
                    |               |
            Service backend   Service frontend
                    |               |
          Deployment backend  Deployment frontend
                    |                (2 реплики)
    Headless Service postgres-db
                    |
    StatefulSet postgres (postgres-0)
                    |
  volumeClaimTemplates → PVC (автоматически)
```

Развёрнуто в namespace `todo-app`.

### Мониторинг (`monitoring-chart`)

```
Prometheus ──┬── scrape: kubernetes-node-exporter (DaemonSet, обе ноды)
             ├── scrape: kubernetes-cadvisor (kubelet API, обе ноды)
             └── alerting → Alertmanager

Grafana ──── datasources: Prometheus + Loki
             dashboards: node.json, docker.json (provisioning)

Loki ◄────── Promtail (DaemonSet, обе ноды) — сбор логов контейнеров
```

Развёрнуто в namespace `monitoring`.

## Быстрый старт

```bash
# Запустить локальный кластер из двух нод
minikube start --nodes=2 --driver=docker --cni=calico

# Пометить ноды по ролям
kubectl label nodes minikube role=app
kubectl label nodes minikube-m02 role=monitoring

# Включить Ingress controller и Metrics server
minikube addons enable ingress
minikube addons enable metrics-server

# Развернуть приложение
cat > todo-app-chart/values-secret.yml << EOF
postgres:
  password: <пароль>
EOF

helm install todo-app ./todo-app-chart -f todo-app-chart/values.yml -f todo-app-chart/values-secret.yml

# Развернуть мониторинг
cat > monitoring-chart/values-secret.yml << EOF
grafana:
  adminPassword: <пароль>
alertmanager:
  smtpPassword: <пароль>
EOF

helm install monitoring ./monitoring-chart -f monitoring-chart/values.yml -f monitoring-chart/values-secret.yml

# Проверить статус
kubectl get pods -n todo-app
kubectl get pods -n monitoring -o wide   # -o wide покажет распределение по нодам
```

> Оба `values-secret.yaml` содержат пароли и намеренно добавлены в
> `.gitignore` — не хранятся в репозитории. Файлы нужно создать локально
> перед установкой.

## Доступ к приложению

Через порт-форвард на Ingress controller (проще всего для локального теста):

```bash
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80 --address 0.0.0.0
```

Приложение доступно по адресу `http://<IP_VM>:8080`.

## Доступ к мониторингу

Grafana и Prometheus доступны через port-forward напрямую на их Service
(отдельный Ingress для мониторинга не заводился — усложняет настройку
из-за префиксов путей, не даёт ощутимой пользы для локальной практики):

```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000 --address 0.0.0.0
kubectl port-forward -n monitoring svc/prometheus 9090:9090 --address 0.0.0.0
```

Grafana: `http://<IP_VM>:3000`
Prometheus: `http://<IP_VM>:9090`

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

### StatefulSet — для PostgreSQL вместо Deployment
База данных развёрнута как `StatefulSet`, а не `Deployment`. Для
stateless-компонентов (backend, frontend) Deployment подходит идеально —
все реплики взаимозаменяемы. Для базы данных это не так:

- **Стабильное имя Pod'а** — `postgres-0`, а не случайный суффикс вида
  `postgres-79d97d9fc-dqncn`, который меняется при каждом пересоздании
- **Персональный PVC на реплику** — через `volumeClaimTemplates`
  StatefulSet сам создаёт `PersistentVolumeClaim` для каждой реплики
  (`postgres-storage-postgres-0`), без ручного создания PVC отдельно
- **Headless Service** (`clusterIP: None`) — вместо балансировки трафика
  между репликами даёт каждой Pod'е собственное стабильное DNS-имя,
  необходимое для корректной работы StatefulSet

Данные базы переживают пересоздание Pod'а благодаря PVC — аналог volume
в Docker Compose, но с гарантией что конкретная реплика всегда
подключается к своему собственному хранилищу.

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

### Init Container — гарантия порядка запуска
Backend использует 'initContainer', который ждёт готовкности Postgres
перед стартомосновного контейнера:

```yaml
initContainers:
  - name: wait-for-postgres
    image: busybox:1.36
    command: ['sh', '-c', 'until nc -z postgres-db 5432; do sleep 2; done']
```

InitContainer блокирует старт основонго контейнера полностью, пока условие не выполнится.
Это решает проблему, когда backend мог упасть при первом запуске, пытаясь создать схему БД
раньше, чем Postgres был готов принимать соединения.

### Namespace — изоляция
Всё приложение развёрнуто в отдельном namespace `todo-app`, а не в `default`.
Это стандартная практика — разделяет ресурсы проекта от служебных
(`ingress-nginx`, `kube-system`) и других приложений в кластере.

### Helm — упаковка манифестов в chart
Все манифесты собраны в Helm chart `todo-app-chart` вместо отдельных
файлов, применяемых по одному через `kubectl apply`:

- **`values.yaml`** — единое место для всех изменяемых параметров
  (образы, теги, порты, количество реплик, пароли базы данных).
  Манифесты в `templates/` не содержат жёстко прописанных значений —
  везде подстановки вида `{{ .Values.backend.replicas }}`
- **Один релиз одной командой** — `helm install todo-app ./todo-app-chart`
  разворачивает весь стек (namespace, secret, configmap, StatefulSet,
  deployments, services, ingress) вместо восьми последовательных
  `kubectl apply -f`
- **Управление жизненным циклом релиза** — `helm upgrade` применяет
  изменения (например новый тег образа или другое число реплик) без
  ручного повторного накатывания всех файлов; `helm rollback` откатывает
  к предыдущей версии релиза при необходимости

Это даёт возможность держать разные `values.yaml` под разные окружения
(dev/prod) без дублирования самих манифестов.

### NetworkPolicy - ограничение сетевого доступа
Для работы этого модуля необходим CNI (calico, kindnet).
>>>>>>> 0672500660564e63a85d116cf38617816a13a2ea
Манифест `postgres-networkpolicy.yml` ограничиввает входящий трафик к
Postgres. Разрешает подключение Pod'ов только app: backend, блокируя доступ
остальных Pod'ов.
```yaml
# templates/postgres-networkpolicy.yml
podSelector:
  mathcLabels:
    app: postgres
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: backend
    ports:
      - protocol: TCP
        port: 5432
```

### HorizontalPodAutoScaler - автомасштабирование frontend
Для работы требуется addon metrics-server, для контроля зарузки Pod`ов.

Количество реплик frontend управляется автоматически через HPA
на основе загруки CPU:
```yaml
# templates/frontend-hpa.yml
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: frontend
  minReplicas: {{ .Values.frontend.min_replicas }}
  maxReplicas: {{ .Values.frontend.max_replicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

Количество реплик frontend, ранее жестко заданное в конфиге убрано и регулируется HPA.

## Мониторинг — что реализовано (`monitoring-chart`)

### Многонодовый кластер и nodeSelector
Кластер поднят с двумя нодами, помеченными по ролям (`role=app`,
`role=monitoring`). Компоненты мониторинга (Prometheus, Grafana, Loki,
Alertmanager) закреплены за monitoring-нодой через:
```yaml
nodeSelector:
  role: monitoring
```
Это физически разносит нагрузку приложения и мониторинга, как раньше
было на двух отдельных VM в Selectel, но теперь под управлением одного
кластера.

### DaemonSet — Promtail и node-exporter
В отличие от `Deployment`, `DaemonSet` не принимает `replicas` — вместо
этого Kubernetes создаёт ровно один Pod **на каждой ноде** кластера
автоматически. Это необходимо для компонентов, которые должны собирать
данные с каждой машины:
- **Promtail** — читает логи контейнеров с локального диска каждой ноды
  (`hostPath` на `/var/lib/docker/containers`)
- **node-exporter** — снимает системные метрики (CPU, память, диск) с
  каждой ноды напрямую (`hostPID: true`, `hostNetwork: true`)

Без DaemonSet единственный Pod мог бы оказаться только на
monitoring-ноде, и логи/метрики с ноды приложения не собирались бы вовсе.

### Метрики контейнеров через kubelet, без отдельного cAdvisor
Первоначально cAdvisor разворачивался как отдельный DaemonSet (как в
Docker Compose), но в среде minikube с драйвером `docker` он падает
из-за конфликта примонтированного `/var/lib/docker` с overlay-файловой
системой самого хоста-контейнера ("Docker в Docker").

Решение — cAdvisor не разворачивается отдельно: kubelet уже включает
эту функциональность "из коробки" и отдаёт метрики контейнеров через
`/api/v1/nodes/<node>/proxy/metrics/cadvisor`. Prometheus обращается
к этому эндпоинту напрямую:
```yaml
- job_name: "kubernetes-cadvisor"
  kubernetes_sd_configs:
    - role: node
  scheme: https
  tls_config:
    ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    insecure_skip_verify: true
  bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
```
Это более "kubernetes-native" подход, чем в Docker Compose — на
реальном Selectel Managed Kubernetes отдельный cAdvisor тоже не
потребовался бы.

### RBAC — права Prometheus на чтение Kubernetes API
Чтобы Prometheus мог автоматически находить Pod'ы через
`kubernetes_sd_configs` (service discovery) вместо статичных IP-адресов,
ему нужны права на чтение объектов кластера. Настроено через три объекта:
- `ServiceAccount` — отдельная "личность", от имени которой работает Pod
- `ClusterRole` — список разрешённых действий (`get`, `list`, `watch`
  над `nodes`, `services`, `endpoints`, `pods`)
- `ClusterRoleBinding` — связывает ServiceAccount с ClusterRole

Без этого Prometheus получал бы `Forbidden` при попытке обратиться к
Kubernetes API.

### Конфиги как ConfigMap через `.Files.Get` и `tpl`
Конфигурационные файлы (`prometheus.yml`, `rules.yml`, `loki-config.yml`,
`alertmanager.yml`) хранятся как обычные файлы в `files/` и подключаются
в ConfigMap через `.Files.Get`, а не переписываются построчно в шаблоне:
```yaml
data:
  prometheus.yml: |
{{ .Files.Get "files/prometheus/prometheus.yml" | indent 4 }}
```
Это важно, так как некоторые конфиги (например `rules.yml`) сами содержат
`{{ $labels.instance }}` — синтаксис Prometheus, а не Helm. `.Files.Get`
читает файл как есть, не пытаясь обработать его шаблонизатором.

Там, где конфиг всё же должен подставлять переменные Helm (например пароль
SMTP в `alertmanager.yml`), используется `tpl`, который сначала прогоняет
файл через шаблонизатор, а потом уже вставляет результат:
```yaml
data:
  alertmanager.yml: |
{{ tpl (.Files.Get "files/alertmanager/alertmanager.yml") . | indent 4 }}
```

### Дашборды Grafana через provisioning
Дашборды (`node.json`, `docker.json`) и datasources (Prometheus, Loki)
подключены через стандартный механизм provisioning Grafana — ConfigMap
монтируется целиком как директория, каждый ключ становится отдельным
файлом:
```yaml
volumeMounts:
  - name: dashboards
    mountPath: /var/lib/grafana/dashboards
```
Grafana сама сканирует папку и подхватывает все `.json` файлы —
не нужно создавать дашборды вручную через UI.


## Структура манифестов

Манифесты собраны в Helm chart `todo-app-chart`:

| Файл | Объекты |
|---|---|
| `Chart.yaml` | Метаданные chart'а |
| `values.yml` | Параметры по умолчанию (образы, реплики, пароли и т.д.) |
| `templates/namespace.yml` | Namespace `todo-app` |
| `templates/postgres-secret.yml` | Secret с паролями и строкой подключения |
| `templates/backend-configmap.yml` | ConfigMap с переменными backend |
| `templates/postgres-networkpolicy.yml` | Network policy для postgres |
| `templates/postgres.yml` | Headless Service + StatefulSet для PostgreSQL |
| `templates/backend.yml` | Deployment + Service для backend (с probes и лимитами) |
| `templates/frontend.yml` | Deployment + Service для frontend |
| `templates/ingress.yml` | Ingress с маршрутизацией `/api` и `/` |

Манифесты мониторинга собраны в Helm chart `monitoring-chart`:

| Файл | Объекты |
|---|---|
| `values.yml` | Параметры по умолчанию (образы, storage, SMTP-настройки) |
| `templates/namespace.yml` | Namespace `monitoring` |
| `templates/rbac.yml` | ServiceAccount + ClusterRole + ClusterRoleBinding для Prometheus |
| `templates/prometheus-config.yml` | ConfigMap с `prometheus.yml` |
| `templates/prometheus-rules-configmap.yml` | ConfigMap с правилами алертов |
| `templates/prometheus.yml` | PVC + Deployment + Service для Prometheus |
| `templates/alertmanager-config.yml` | ConfigMap с `alertmanager.yml` (через `tpl`) |
| `templates/alertmanager.yml` | Deployment + Service для Alertmanager |
| `templates/loki-config.yml` | ConfigMap с `loki-config.yml` |
| `templates/loki.yml` | PVC + Deployment + Service для Loki |
| `templates/promtail-config.yml` | ConfigMap с `promtail-config.yml` |
| `templates/promtail.yml` | DaemonSet для Promtail (обе ноды) |
| `templates/node-exporter.yml` | DaemonSet + Service для node-exporter (обе ноды) |
| `templates/grafana-datasources.yml` | ConfigMap с datasources (Prometheus, Loki) |
| `templates/grafana-dashboards.yml` | ConfigMap с provisioning-конфигом и дашбордами |
| `templates/grafana-secret.yml` | Secret с паролем администратора Grafana |
| `templates/grafana.yml` | PVC + Deployment + Service для Grafana |

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

# Проверить PVC, автоматически созданный StatefulSet
kubectl get pvc -n todo-app

# Проверить стабильность имени Pod'а Postgres при пересоздании
kubectl delete pod postgres-0 -n todo-app
kubectl get pods -n todo-app   # снова появится postgres-0, не случайный суффикс

# Обновить релиз после изменений в values.yaml
helm upgrade todo-app ./todo-app-chart -f values.yaml -f values-secret.yaml

# Посмотреть историю релизов
helm history todo-app

# Откатиться к предыдущей версии релиза
helm rollback todo-app 1

# Удалить весь релиз целиком
helm uninstall todo-app

# Проверить распределение Pod'ов мониторинга по нодам
kubectl get pods -n monitoring -o wide

# Проверить targets Prometheus (после port-forward на 9090)
# в браузере: http://<IP_VM>:9090/targets

# Проверить, что Prometheus видит метрики контейнеров через kubelet напрямую
kubectl get --raw /api/v1/nodes/<node-name>/proxy/metrics/cadvisor | head -30

# Обновить релиз мониторинга после изменений в values
helm upgrade monitoring ./monitoring-chart -f monitoring-chart/values.yaml -f monitoring-chart/values-secret.yaml
```

## В планах

- [ ] Разворачивание в managed Kubernetes (например Selectel Managed Kubernetes)

