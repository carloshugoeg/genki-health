# Entrega I — Análisis y modelo relacional

Primera entrega del proyecto Genki Health. Bases de Datos II, Universidad Rafael Landívar. Catedrático: Ing. José Arturo Monterroso. Integrantes: Carlos Hugo Escobar Gómez y Héctor Jordin Adolfo García Coyoy. Fecha del documento: 8 de septiembre de 2026.

## Archivos

| Archivo | Contenido |
| --- | --- |
| `entrega-i.pdf` | Documento entregado, con las figuras originales. Es la fuente principal. |
| `analisis-y-modelo-relacional.md` | Transcripción buscable del texto del PDF, con las correcciones de modelado anotadas. |
| `diagramas/` | Diagramas reconstruidos a partir del texto: vistas ER, Chen detallados y modelo relacional. Ver `diagramas/README.md`. |

## Dónde está cada resultado del enunciado

| Resultado esperado | Sección | Archivo |
| --- | --- | --- |
| Entidades identificadas | 4 | `analisis-y-modelo-relacional.md` |
| Lista de atributos por entidad | 5 | `analisis-y-modelo-relacional.md` |
| Modelo entidad-relación de las instituciones relacionales | 6 | Vistas 6.2/6.3: `diagramas/er-hospital-general.*`, `diagramas/er-centro-pediatrico.*`. Detalle 6.4: `diagramas/chen-6.4.*` |
| Modelo relacional de las instituciones relacionales | 7 | `diagramas/rel-*.mmd` y la sección 7 de la transcripción |
| Base de datos normalizada | 8 | `analisis-y-modelo-relacional.md` |
| Información pública, confidencial y restringida | 9 | `analisis-y-modelo-relacional.md` |
| Operaciones en lenguaje sencillo | 10 | `analisis-y-modelo-relacional.md`, de OP-01 a OP-77 |

## Instituciones modeladas

| Institución | Motor | Qué incluye esta entrega |
| --- | --- | --- |
| Hospital general | PostgreSQL | ER, modelo relacional y normalización |
| Centro médico pediátrico | MySQL | ER, modelo relacional y normalización |
| Laboratorio clínico | MongoDB | Entidades, atributos, clasificación y operaciones |
| Clínica odontológica | Firebase (Firestore) | Entidades, atributos, clasificación y operaciones |

Los tipos físicos de cada motor no se deciden en esta entrega (supuesto 15 del documento). Se definen en las migraciones de la Entrega II (`server/src/adapters/{postgres,mysql}/migrations/`) y en el modelo documental de MongoDB y Firestore (`../ENTREGA-II/`).
