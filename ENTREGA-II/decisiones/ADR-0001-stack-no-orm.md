# ADR-0001 — Stack tecnológico y ausencia de ORM

- Estado: Aceptada
- Fecha: 2026-08-27

## Contexto

El curso evalúa el modelado, las transacciones y la seguridad de cada motor por separado. Un ORM ocultaría justamente las diferencias que se quieren mostrar entre PostgreSQL, MySQL, MongoDB y Firestore.

## Decisión

Aplicación TypeScript de punta a punta: API Fastify y cliente web React + Vite, organizados como npm workspaces (`server/`, `web/`, `shared/`). El servidor sigue una arquitectura hexagonal (puertos y adaptadores) y no usa ORM: cada adaptador usa el driver nativo del motor (`pg`, `mysql2`, `mongodb`, `firebase-admin`).

## Consecuencias

Las reglas de dependencia del hexágono se verifican con dependency-cruiser (`.dependency-cruiser.cjs`, `npm run depcruise`). El SQL, las migraciones y el mapeo de documentos se escriben a mano en `server/src/adapters/{postgres,mysql,mongodb,firebase}/`.
