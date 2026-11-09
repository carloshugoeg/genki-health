# ADR-0002 — Asignación institución → motor

- Estado: Aceptada
- Fecha: 2026-08-27

## Contexto

El enunciado pide cuatro instituciones independientes y que cada una use un motor distinto, una sola vez.

## Decisión

| Institución | Motor |
| --- | --- |
| Hospital general | PostgreSQL |
| Centro médico pediátrico | MySQL |
| Laboratorio clínico | MongoDB |
| Clínica odontológica | Firebase (Firestore) |

La asignación está codificada en `@genki/shared` como `INSTITUTION_ENGINE_ASSIGNMENTS` (`shared/src/engines.ts`) y el registro de adaptadores (`server/src/config/adapter-registry.ts`) rechaza cualquier otra combinación.

## Consecuencias

La justificación de cada asignación está en la sección 1 del documento comparativo (`ENTREGA-II/documento-comparativo.md`).
