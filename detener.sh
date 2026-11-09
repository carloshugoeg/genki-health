#!/usr/bin/env bash
# Genki Health — detiene la API, la web y los contenedores que lanzó levantar.sh.
#   bash detener.sh                 conserva los datos (volúmenes de Docker)
#   bash detener.sh --borrar-datos  borra también los volúmenes (la próxima vez se recrea todo)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ"
RUNTIME="$RAIZ/.runtime"
MODO="${1:-}"
case "$MODO" in
  "" | --borrar-datos | --solo-procesos) ;;
  *)
    echo "Uso: bash detener.sh [--borrar-datos]" >&2
    exit 2
    ;;
esac

# API y web: solo los procesos registrados por levantar.sh (y solo si siguen siendo node).
for nombre in api web; do
  archivo="$RUNTIME/$nombre.pid"
  [ -f "$archivo" ] || continue
  pid="$(cat "$archivo")"
  if ps -p "$pid" -o command= 2>/dev/null | grep -q node; then
    kill "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      ps -p "$pid" >/dev/null 2>&1 || break
      sleep 0.5
    done
    kill -9 "$pid" 2>/dev/null || true
    echo "    $nombre detenida (pid $pid)."
  fi
  rm -f "$archivo"
done
[ "$MODO" = "--solo-procesos" ] && exit 0

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker no está disponible; no hay contenedores que detener."
  exit 0
fi
set -- -f infra/entrega/docker-compose.yml
[ -f .env ] && set -- "$@" --env-file .env
if [ "$MODO" = "--borrar-datos" ]; then
  docker compose "$@" down --volumes
  echo "Genki Health detenido y datos borrados. Para empezar de cero: bash levantar.sh"
else
  docker compose "$@" down
  echo "Genki Health detenido (los datos se conservan). Para volver a levantarlo: bash levantar.sh"
fi
