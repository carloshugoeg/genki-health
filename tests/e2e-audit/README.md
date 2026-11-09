# Auditoría de punta a punta

Pruebas automatizadas contra la aplicación levantada con los cuatro motores (`GENKI_MODE=engines`). Requieren la API y la web corriendo (ver «Cómo levantarlo» en el `README.md` de la raíz). Por defecto usan `http://127.0.0.1:3000` y `http://localhost:5173`; si la aplicación quedó en otros puertos, indicarlos con `GENKI_API` y `GENKI_WEB`.

```bash
node tests/e2e-audit/api-audit.mjs            # fase 1: flujo completo en las 4 instituciones (~40 s)
# reiniciar la API y los contenedores de base de datos, y luego:
node tests/e2e-audit/api-audit.mjs --verify   # fase 2: los datos creados en la fase 1 siguen ahí
node tests/e2e-audit/web-smoke.mjs            # Playwright: login y pantallas, sin errores de consola
```

| Script | Qué comprueba |
| --- | --- |
| `api-audit.mjs` | Login y enrutamiento por motor, registro y búsqueda de paciente, historial, agenda, consulta con diagnóstico, tratamiento y receta (incluido el rollback), archivo, usuarios, validación de entradas y aislamiento entre instituciones. |
| `api-audit.mjs --verify` | Persistencia tras reiniciar API y contenedores. Usa el `results/state.json` que deja la fase 1. |
| `web-smoke.mjs` | Recorre el login y las pantallas con los usuarios demo y registra errores de JavaScript y respuestas 403. |

Variables opcionales: `GENKI_API` (URL de la API), `GENKI_WEB` (URL de la web), `GENKI_PASS` (contraseña demo, por defecto `admin123!`).

- Los datos de prueba llevan el prefijo `E2E-AUDIT-<corrida>` (pacientes, citas y usuarios `e2e-audit-…@example.invalid`).
- Los resultados quedan en `results/`; las contraseñas temporales y los tokens se redactan antes de guardar.
- Un FAIL es un hallazgo de la aplicación, no un error del script. Los resultados de referencia y el análisis de los FAIL están en la sección 7 de `ENTREGA-II/documento-comparativo.md`.
