#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="$ROOT/.local-runtime"
export COMPOSE_PROJECT_NAME=genki-mvp-20261108
for f in firestore.pid api.pid web.pid; do
  if [[ -f "$RUNTIME/$f" ]]; then
    pid="$(cat "$RUNTIME/$f")"
    # kill process group/children when possible
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    rm -f "$RUNTIME/$f"
  fi
done
# also stop java firestore / vite / server leftovers on our ports only
for p in 3000 5173 8080 4400 4500 9150; do
  pids=$(lsof -nP -iTCP:$p -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "${pids:-}" ]]; then kill $pids 2>/dev/null || true; fi
done
docker compose --env-file "$ROOT/.env" -p genki-mvp-20261108 -f "$ROOT/infra/local-isolated/docker-compose.isolated.yml" down || true
echo "Stopped Genki MVP (API/web/firestore + compose genki-mvp-20261108). Left 5433 and host mongod 27017 untouched."
