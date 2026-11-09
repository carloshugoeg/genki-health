# ADR-0004 — Agregados en Firestore (Clínica odontológica)

- Estado: Aceptada
- Fecha: 2026-11-06

## Contexto

La clínica odontológica (institución 4) usa Firestore. El cliente React nunca habla con Firestore directamente: todo pasa por el backend. Los números de documento pueden contener `/`, así que no sirven como id de documento. El historial de consultas no tiene límite, igual que en MongoDB.

## Decisión

- Los datos viven bajo `institutions/{institutionId}`, con colecciones hijas para pacientes, expedientes, responsables, consultas, catálogos, contadores y el resumen de reportes.
- **Embeber** el detalle clínico acotado dentro del documento de la consulta; **referenciar** las historias de paciente y expediente.
- La unicidad del número de documento se garantiza con una reserva `documentKeys/{sha256}` que se lee y se crea dentro de la transacción de registro.
- El backend usa el Admin SDK, que ignora las reglas de seguridad; por eso el control de acceso efectivo es la autenticación HTTP (JWT) y los puertos restringidos a la institución. Las reglas (`infra/firebase/firestore.rules`) niegan por defecto el acceso directo de clientes y solo permiten a una identidad de reportes leer documentos no clínicos.

## Consecuencias

Los índices compuestos para las consultas de historial están en `infra/firebase/firestore.indexes.json`. La entrega se ejecuta contra el emulador local de Firestore (proyecto `demo-genki-health`), por lo que no requiere credenciales de Google Cloud.
