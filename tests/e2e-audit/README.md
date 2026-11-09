# Auditoría E2E (runtime real, GENKI_MODE=engines)

Requiere el runtime levantado (`bash infra/local-isolated/start.sh`, API :3000, web :5173).

```bash
node tests/e2e-audit/api-audit.mjs            # fase 1: flujo completo en las 4 instituciones (~40 s)
# reiniciar API y contenedores (ver docs/HANDOFF-JORDIN.md) y luego:
node tests/e2e-audit/api-audit.mjs --verify   # fase 2: persistencia tras reinicio
node tests/e2e-audit/web-smoke.mjs            # Playwright: login + pantallas, errores de consola
```

- Datos de prueba con prefijo `E2E-AUDIT-<run>` (pacientes, citas, usuarios `e2e-audit-…@example.invalid`).
- Resultados en `results/` (contraseñas temporales y tokens redactados).
- Un FAIL es un hallazgo, no un fallo del script: ver la lista priorizada en `docs/HANDOFF-JORDIN.md`.
- Corrida de referencia 2026-11-09 (run 20261109D): flujo 508/578 PASS, persistencia 17/17 PASS, 52/52 checks cross-tenant PASS.
