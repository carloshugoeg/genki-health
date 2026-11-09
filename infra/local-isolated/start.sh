#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="$ROOT/.local-runtime"
cd "$ROOT"
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
if [[ -d /opt/homebrew/opt/simdjson/lib ]]; then
  ln -sf libsimdjson.34.dylib /opt/homebrew/opt/simdjson/lib/libsimdjson.33.dylib 2>/dev/null || true
fi
set -a
source <(python3 - <<'PY2'
from pathlib import Path
import shlex
for line in Path('.env').read_text().splitlines():
  line=line.strip()
  if not line or line.startswith('#') or '=' not in line: continue
  k,v=line.split('=',1)
  print(f'{k}={shlex.quote(v)}')
PY2
)
set +a
unset FIRESTORE_EMULATOR_HOST FIREBASE_AUTH_EMULATOR_HOST || true
export FIRESTORE_MODE="${FIRESTORE_MODE:-real}"
export SEED_PASSWORD="${SEED_PASSWORD:-admin123!}"
export GENKI_MODE="${GENKI_MODE:-engines}"
mkdir -p "$RUNTIME/logs"
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-5173}"
for name in api web; do
  if [[ -f "$RUNTIME/${name}.pid" ]]; then kill "$(cat "$RUNTIME/${name}.pid")" 2>/dev/null || true; fi
done
for p in "$API_PORT" "$WEB_PORT"; do lsof -ti tcp:"$p" 2>/dev/null | xargs kill -9 2>/dev/null || true; done
sleep 1
nohup npm run dev --workspace=server >"$RUNTIME/logs/api.log" 2>&1 &
echo $! >"$RUNTIME/api.pid"
nohup npm run dev --workspace=web >"$RUNTIME/logs/web.log" 2>&1 &
echo $! >"$RUNTIME/web.pid"
echo "Started API pid=$(cat "$RUNTIME/api.pid") WEB pid=$(cat "$RUNTIME/web.pid")"
for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
    echo "API healthy after ${i}s"
    curl -s "http://127.0.0.1:${API_PORT}/health"; echo
    exit 0
  fi
  sleep 1
done
echo "API failed to become healthy; see $RUNTIME/logs/api.log" >&2
tail -40 "$RUNTIME/logs/api.log" >&2 || true
exit 1
