# ADR-0003 — Agregados en MongoDB (Laboratorio clínico)

- Estado: Aceptada
- Fecha: 2026-11-06

## Contexto

El laboratorio clínico (institución 3) usa MongoDB 7 con el conjunto de réplicas `rs0`, necesario para transacciones multi-documento. Debe persistir los mismos DTO clínicos que los motores SQL sin exponer identificadores con forma de ObjectId. El historial de consultas de un paciente no tiene límite, así que embeber todas las consultas bajo el paciente o el expediente haría crecer el documento sin control.

## Decisión

- Llaves numéricas sustitutas y `_id` con forma `<institución>:<id numérico>`.
- **Embeber** diagnósticos, tratamientos y detalle de receta dentro de la consulta: es un paquete clínico acotado (menos de 256 KiB) que se escribe de forma atómica.
- **Referenciar** las consultas desde el expediente (nunca embebidas en el paciente), porque el historial no tiene límite.
- Los responsables del paciente son documentos aparte que se escriben con paciente y expediente en una misma transacción.
- Los catálogos se referencian por id entero.
- Los resultados de examen son documentos separados que referencian su orden (`server/src/adapters/mongodb/full/lab-results.ts`), nunca un arreglo ilimitado bajo el paciente.

Los validadores `$jsonSchema` y los índices están en `server/src/adapters/mongodb/schema.ts` y `schema.json`.

## Consecuencias

El servidor requiere el conjunto de réplicas `rs0` con autenticación. La comparación con los demás motores está en las secciones 2 y 6 del documento comparativo.
