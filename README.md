# Genki Health

Plataforma compartida de historiales clínicos para cuatro instituciones médicas independientes. Proyecto final de Bases de Datos II, Universidad Rafael Landívar.

El enunciado está en `PROJECT-DESC.md`. Entrega I vive en `docs/entregas/entrega-1/`. Entrega II tiene el scaffold en `main` (PR #10); el trabajo restante está indexado como tickets **E2-P***. E1-05 (Chen pediátrico) corre en paralelo y no bloquea E2. Los adaptadores reales siguen incompletos.

## Arranque local (Phase 0)

```bash
npm install
npm run validate          # o: bash scripts/validate.sh
npm run build -w @genki/shared
npm run dev -w @genki/server   # API en :3000
npm run dev -w @genki/web      # SPA en :5173
```

Motores opcionales:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Auth (Carlos 2026-10-19): `POST /api/auth/login` con email, password e `institution_kind`. Access JWT 30m + refresh 14d. Demo email `hospital@genki.local` (análogos por institución). Requiere `JWT_SECRET` y `SEED_PASSWORD` en `.env` (ver `.env.example`; sin valores de ejemplo en el repo).

## Layout

| Ruta | Rol |
| --- | --- |
| `server/` | Fastify + hexagonal (domain / application / ports / adapters / config) |
| `web/` | React + Vite SPA |
| `shared/` | DTOs y asignación institución → motor |
| `infra/` | Docker Compose + emulador Firebase |
| `scripts/validate.sh` | Compuerta local (= CI) |
| `poteto-mode/` | Cola de tickets y decisiones |

## Qué hacer ahora

1. Leer `AGENTS.md`.
2. Leer `poteto-mode/queue/NOW.md`.
3. Hacer ese ticket y nada más.

Carlos (Cursor) posee Hospital general (PostgreSQL) y Laboratorio clínico (MongoDB), más CI. Jordin (Claude) posee Centro pediátrico (MySQL) y Clínica odontológica (Firebase), más la suite de contratos.
