#!/bin/sh
# Arranca el emulador de Firestore escuchando en 0.0.0.0:8080 y conserva los datos en /data
# (volumen de Docker): importa la exportación previa si existe y exporta al detenerse.
set -eu
EXPORTACION=/data/export
set -- --host 0.0.0.0 --port 8080 --export-on-exit "$EXPORTACION"
if [ -d "$EXPORTACION" ]; then
  set -- "$@" --import-data "$EXPORTACION"
fi
exec java -jar /opt/firestore-emulator.jar "$@"
