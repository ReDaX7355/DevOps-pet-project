#!/bin/bash
set -e

echo "Pull latest images..."
docker compose -f docker-compose.prod.yml pull

echo "Recreate containers..."
docker compose --env-file .env -f docker-compose.prod.yml up -d --remove-orphans

echo "Prune old images..."
docker image prune -f

echo "Deploy complete."
