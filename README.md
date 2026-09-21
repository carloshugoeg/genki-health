# Genki Health

Plataforma compartida de historiales clínicos para cuatro instituciones médicas independientes. Proyecto final de Bases de Datos II, Universidad Rafael Landívar.

El enunciado está en `PROJECT-DESC.md`. La Entrega I ya está analizada. El PDF y la transcripción viven en `docs/entregas/entrega-1/`.

## Qué hay que hacer ahora

Los agentes no eligen el alcance. El siguiente trabajo es un solo ticket.

1. Leer `AGENTS.md`.
2. Leer `poteto-mode/queue/NOW.md`.
3. Hacer ese ticket y nada más.

El mapa de capacidades está en `poteto-mode/feature-map.md`. No es otro backlog.

Carlos Hugo Escobar y Héctor Jordin Adolfo García Coyoy deciden la arquitectura y el modelo. La implementación se delega. Cursor trabaja los tickets de Carlos. Claude trabaja los de Jordin.

## Entrega I

| Resultado que pide el enunciado | Dónde está |
| --- | --- |
| Modelo entidad-relación de las instituciones relacionales | `docs/entregas/entrega-1/diagramas/er-hospital-general.*` y `er-centro-pediatrico.*`. Los diagramas detallados de la sección 6.4 son el ticket en curso. |
| Modelo relacional | `docs/entregas/entrega-1/diagramas/rel-*.mmd` y la sección 7 de la transcripción |
| Entidades identificadas | Sección 4 de la transcripción. Son 58. |
| Atributos por entidad | Sección 5 |
| Información pública, confidencial y restringida | Sección 9, las cuatro instituciones |
| Base de datos normalizada | Sección 8. El esquema textual de las secciones 7.4 y 7.5 está en BCNF según el documento. |
| Operaciones en lenguaje sencillo | Sección 10, de OP-01 a OP-77 |

Hospital general usa PostgreSQL. Centro médico pediátrico usa MySQL. Esas dos instituciones tienen modelo ER y modelo relacional. Laboratorio clínico (MongoDB) y clínica odontológica (Firebase) entran en el análisis de entidades, atributos, clasificación y operaciones. Su modelo documental es de la Entrega II.

## Lo que este repositorio no es todavía

No hay aplicación. La Entrega II pide el cliente-servidor y los cuatro motores. Ese trabajo está en el backlog como ticket futuro y no se empieza hasta cerrar la Entrega I.
