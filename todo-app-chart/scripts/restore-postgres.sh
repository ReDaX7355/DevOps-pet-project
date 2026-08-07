#!/bin/bash
set -e

NAMESPACE="todo-app"

echo "Получение списка доступных бэкапов..."
echo ""

# Получаем список файлов бэкапов через временный под
POD_NAME="restore-list-$$"

kubectl run "$POD_NAME" --restart=Never \
  --image=busybox -n "$NAMESPACE" \
  --overrides="{\"spec\":{\"nodeSelector\":{\"role\":\"app\"},\"volumes\":[{\"name\":\"backup\",\"persistentVolumeClaim\":{\"claimName\":\"postgres-backup-pvc\"}}],\"containers\":[{\"name\":\"$POD_NAME\",\"image\":\"busybox\",\"command\":[\"sleep\",\"60\"],\"volumeMounts\":[{\"name\":\"backup\",\"mountPath\":\"/backup\"}]}]}}" \
  > /dev/null 2>&1

kubectl wait --for=condition=Ready pod/"$POD_NAME" -n "$NAMESPACE" --timeout=20s > /dev/null 2>&1
BACKUPS=$(kubectl exec "$POD_NAME" -n "$NAMESPACE" -- sh -c "ls -1t /backup/backup_*.sql 2>/dev/null")
kubectl delete pod "$POD_NAME" -n "$NAMESPACE" > /dev/null 2>&1

if [ -z "$BACKUPS" ]; then
  echo "Бэкапы не найдены."
  exit 1
fi

echo "Доступные бэкапы:"
echo "$BACKUPS" | nl -w2 -s') '
echo ""

read -p "Введите номер бэкапа для восстановления: " NUM

SELECTED=$(echo "$BACKUPS" | sed -n "${NUM}p")

if [ -z "$SELECTED" ]; then
  echo "Неверный выбор."
  exit 1
fi

echo ""
echo "Выбран бэкап: $SELECTED"
read -p "Подтвердите восстановление (данные в базе будут перезаписаны) [y/N]: " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Отменено."
  exit 0
fi

echo "Восстановление из $SELECTED..."

kubectl run restore-exec-$$ --rm -i --restart=Never \
  --image=postgres:16 -n "$NAMESPACE" \
  --overrides="{\"spec\":{\"nodeSelector\":{\"role\":\"app\"},\"volumes\":[{\"name\":\"backup\",\"persistentVolumeClaim\":{\"claimName\":\"postgres-backup-pvc\"}}],\"containers\":[{\"name\":\"restore-exec-$$\",\"image\":\"postgres:16\",\"env\":[{\"name\":\"PGPASSWORD\",\"valueFrom\":{\"secretKeyRef\":{\"name\":\"postgres-secret\",\"key\":\"POSTGRES_PASSWORD\"}}}],\"volumeMounts\":[{\"name\":\"backup\",\"mountPath\":\"/backup\"}],\"command\":[\"sh\",\"-c\",\"psql -h postgres-db -U postgres todo_db < $SELECTED\"]}]}, \"metadata\":{\"labels\":{\"app\":\"postgres-backup\"}}}"

echo "Восстановление завершено."

