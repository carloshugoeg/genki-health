#!/usr/bin/env bash
# Genki Health — levanta todo el proyecto con un solo comando:
#   bash levantar.sh
# Requisitos: Docker (con Compose v2) y Node.js >= 20. Funciona en macOS y Linux.
# Es seguro ejecutarlo varias veces. Para detener: bash detener.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ"
RUNTIME="$RAIZ/.runtime"
LOGS="$RUNTIME/logs"
COMPOSE_ARCHIVO="infra/entrega/docker-compose.yml"
INICIO="$(date +%s)"

paso() { printf '\n==> %s\n' "$*"; }
error() {
  printf '\nERROR: %s\n' "$1" >&2
  shift
  for linea in "$@"; do printf '       %s\n' "$linea" >&2; done
  exit 1
}
compose() { docker compose -f "$COMPOSE_ARCHIVO" --env-file .env "$@"; }
puerto_ocupado() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# ---------------------------------------------------------------------------
paso "1/7 Verificando requisitos (Docker y Node.js)"
if ! command -v docker >/dev/null 2>&1; then
  error "Docker no está instalado." \
    "macOS: instala Docker Desktop → https://docs.docker.com/desktop/setup/install/mac-install/" \
    "Linux: instala Docker Engine → https://docs.docker.com/engine/install/" \
    "Luego vuelve a ejecutar: bash levantar.sh"
fi
if ! docker info >/dev/null 2>&1; then
  error "Docker está instalado pero no responde (¿está encendido?)." \
    "macOS: abre Docker Desktop y espera a que diga 'Running'." \
    "Linux: sudo systemctl start docker   (y, si hace falta: sudo usermod -aG docker \$USER, luego cierra sesión)"
fi
if ! docker compose version >/dev/null 2>&1; then
  error "Falta Docker Compose v2 (el subcomando 'docker compose')." \
    "Viene incluido en Docker Desktop. En Linux: https://docs.docker.com/compose/install/linux/"
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  error "Node.js (con npm) no está instalado; se necesita la versión 20 o superior." \
    "Descárgalo de https://nodejs.org (versión LTS) o usa nvm: nvm install 22"
fi
NODE_MAYOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAYOR" -lt 20 ]; then
  error "Node.js $(node -v) es muy antiguo; se necesita la versión 20 o superior." \
    "Descarga la versión LTS de https://nodejs.org o usa nvm: nvm install 22"
fi
echo "    Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?'), $(docker compose version --short 2>/dev/null | sed 's/^/Compose /'), Node $(node -v)"

# ---------------------------------------------------------------------------
paso "2/7 Preparando configuración (.env)"
ENV_EXPORTS="$(node infra/entrega/preparar-env.mjs)" || exit 1
eval "$ENV_EXPORTS"
unset ENV_EXPORTS
mkdir -p "$LOGS"

# Detener API/web de una ejecución anterior (solo los procesos que lanzó este script).
bash "$RAIZ/detener.sh" --solo-procesos

# Puertos: los de los motores solo se revisan si su contenedor aún no está corriendo.
CORRIENDO="$(compose ps --status running --services 2>/dev/null || true)"
for par in "postgres:POSTGRES_PORT" "mysql:MYSQL_PORT" "mongodb:MONGO_PORT" "firestore:FIRESTORE_PORT" "-:API_PORT" "-:WEB_PORT"; do
  servicio="${par%%:*}"
  variable="${par#*:}"
  puerto="${!variable}"
  if printf '%s\n' "$CORRIENDO" | grep -qx -- "$servicio"; then continue; fi
  if puerto_ocupado "$puerto"; then
    error "El puerto $puerto ($variable) ya está ocupado por otro programa." \
      "Cambia $variable en el archivo .env por un puerto libre y vuelve a ejecutar: bash levantar.sh"
  fi
done

# ---------------------------------------------------------------------------
paso "3/7 Levantando motores en Docker (PostgreSQL, MySQL, MongoDB rs0, emulador de Firestore)"
echo "    La primera vez descarga imágenes y construye el emulador (varios minutos)."
if ! compose up -d --wait --wait-timeout 600; then
  compose ps >&2 || true
  error "Algún contenedor no quedó sano." \
    "Revisa los logs con: docker compose -f $COMPOSE_ARCHIVO logs --tail 50"
fi

# ---------------------------------------------------------------------------
paso "4/7 Instalando dependencias de Node (npm ci)"
HUELLA="$(node -e "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('package-lock.json')).digest('hex'))")"
if [ -d node_modules ] && [ "$(cat node_modules/.genki-lock-sha 2>/dev/null || true)" = "$HUELLA" ]; then
  echo "    node_modules ya está al día; se omite."
else
  if ! npm ci --no-audit --no-fund >"$LOGS/npm-ci.log" 2>&1; then
    tail -30 "$LOGS/npm-ci.log" >&2
    error "Falló npm ci. Log completo: .runtime/logs/npm-ci.log"
  fi
  printf '%s' "$HUELLA" >node_modules/.genki-lock-sha
  echo "    Listo."
fi
if ! npm run build -w @genki/shared >"$LOGS/build-shared.log" 2>&1; then
  tail -30 "$LOGS/build-shared.log" >&2
  error "Falló la compilación de shared/. Log: .runtime/logs/build-shared.log"
fi

# ---------------------------------------------------------------------------
paso "5/7 Creando esquemas, usuarios y datos de demostración (npm run db:setup:all)"
if ! npm run db:setup:all >"$LOGS/db-setup.log" 2>&1; then
  tail -40 "$LOGS/db-setup.log" >&2
  error "Falló db:setup:all. Log completo: .runtime/logs/db-setup.log"
fi
grep -E '^institution=' "$LOGS/db-setup.log" | sed 's/^/    /' || true

# ---------------------------------------------------------------------------
paso "6/7 Iniciando API (:$API_PORT) y web (:$WEB_PORT)"
# `cd` va en una línea aparte: así el `&` aplica solo a node y $! es el PID real de node.
(
  cd server || exit 1
  nohup node --import tsx src/main.ts >"$LOGS/api.log" 2>&1 &
  echo $! >"$RUNTIME/api.pid"
)
VITE_BIN="$(cd web && node -p "require('path').join(require('path').dirname(require.resolve('vite/package.json')), 'bin', 'vite.js')")"
(
  cd web || exit 1
  nohup node "$VITE_BIN" --host 127.0.0.1 --port "$WEB_PORT" --strictPort >"$LOGS/web.log" 2>&1 &
  echo $! >"$RUNTIME/web.pid"
)

esperar() { # esperar <url> <segundos>
  node -e '
    const [url, limite] = process.argv.slice(1);
    const fin = Date.now() + Number(limite) * 1000;
    (async () => {
      while (Date.now() < fin) {
        try { if ((await fetch(url)).ok) process.exit(0); } catch {}
        await new Promise((r) => setTimeout(r, 1000));
      }
      process.exit(1);
    })();' "$1" "$2"
}
if ! esperar "http://127.0.0.1:$API_PORT/health" 90; then
  tail -40 "$LOGS/api.log" >&2
  error "La API no respondió en /health. Log: .runtime/logs/api.log"
fi
if ! esperar "http://127.0.0.1:$WEB_PORT/" 60; then
  tail -40 "$LOGS/web.log" >&2
  error "La web no respondió. Log: .runtime/logs/web.log"
fi

# ---------------------------------------------------------------------------
paso "7/7 Comprobando inicio de sesión de demostración a través de la web"
if ! node -e '
  const [web, password] = process.argv.slice(1);
  fetch(`${web}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "demo-1-medico@example.invalid", password, institution_kind: "hospital_general" }),
  }).then((r) => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1));' \
  "http://127.0.0.1:$WEB_PORT" "$SEED_PASSWORD"; then
  tail -20 "$LOGS/api.log" >&2
  error "El login de demostración falló. Log: .runtime/logs/api.log"
fi
echo "    Login OK (demo-1-medico)."

DURACION=$(($(date +%s) - INICIO))
URL="http://127.0.0.1:$WEB_PORT"
cat <<EOF

============================================================
 Genki Health está corriendo  (listo en ${DURACION}s)

   Aplicación web : $URL
   API            : http://127.0.0.1:$API_PORT   (salud: /health)

 Usuarios de demostración (contraseña de todos: $SEED_PASSWORD)
   Correo                                Institución a elegir
   superadmin@example.invalid            Hospital general (superadministrador)
   demo-1-administrador@example.invalid  Hospital general           (PostgreSQL)
   demo-1-medico@example.invalid         Hospital general           (PostgreSQL)
   demo-2-administrador@example.invalid  Centro médico pediátrico   (MySQL)
   demo-2-medico@example.invalid         Centro médico pediátrico   (MySQL)
   demo-3-administrador@example.invalid  Laboratorio clínico        (MongoDB)
   demo-3-medico@example.invalid         Laboratorio clínico        (MongoDB)
   demo-4-administrador@example.invalid  Clínica odontológica       (Firestore emulador)
   demo-4-medico@example.invalid         Clínica odontológica       (Firestore emulador)
   demo-4-odontologo@example.invalid     Clínica odontológica       (Firestore emulador)
   (también existen demo-N-recepcion y demo-N-auditor, N = 1..4)

 Logs     : .runtime/logs/  (api.log, web.log, db-setup.log)
 Detener  : bash detener.sh                 (conserva los datos)
            bash detener.sh --borrar-datos  (borra también los volúmenes)
============================================================
EOF

if [ -z "${GENKI_NO_ABRIR:-}" ]; then
  if command -v open >/dev/null 2>&1 && [ "$(uname -s)" = "Darwin" ]; then
    open "$URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  fi
fi
