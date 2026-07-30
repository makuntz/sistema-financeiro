#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo ">> Subindo infraestrutura local..."
docker compose up -d

echo ">> Aguardando PostgreSQL..."
until docker compose exec -T postgres pg_isready -U pp_planning -d pp_planning >/dev/null 2>&1; do
  sleep 1
done

echo ">> Infraestrutura pronta."
