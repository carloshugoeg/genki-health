# Entrega I — Análisis y modelo relacional

Documento de la primera entrega. Catedrático: Ing. José Arturo Monterroso. Integrantes: Carlos Hugo Escobar Gómez y Héctor Jordin Adolfo García Coyoy. Fecha del documento: 8 de septiembre de 2026.

## Dónde está cada resultado del enunciado

| Resultado esperado | Sección | Archivo |
| --- | --- | --- |
| Modelo entidad-relación de las instituciones relacionales | 6 | `diagramas/er-hospital-general.*`, `diagramas/er-centro-pediatrico.*`. El detalle de la sección 6.4 es el ticket E1-02 y los que le siguen. |
| Modelo relacional de las instituciones relacionales | 7 | `diagramas/rel-*.mmd` y la sección 7 de la transcripción |
| Entidades identificadas | 4 | `analisis-y-modelo-relacional.md` |
| Lista de atributos por entidad | 5 | `analisis-y-modelo-relacional.md` |
| Información pública, confidencial y restringida | 9 | `analisis-y-modelo-relacional.md` |
| Base de datos normalizada | 8 | `analisis-y-modelo-relacional.md` |
| Operaciones en lenguaje sencillo | 10 | `analisis-y-modelo-relacional.md`, de OP-01 a OP-77 |

## Instituciones que se modelan aquí

| Institución | Motor | Qué incluye esta entrega |
| --- | --- | --- |
| Hospital general | PostgreSQL | ER, modelo relacional y normalización |
| Centro médico pediátrico | MySQL | ER, modelo relacional y normalización |
| Laboratorio clínico | MongoDB | Entidades, atributos, clasificación y operaciones |
| Clínica odontológica | Firebase (Firestore) | Entidades, atributos, clasificación y operaciones |

## Archivos

- `entrega-i.pdf` es el documento exportado, con las figuras originales.
- `analisis-y-modelo-relacional.md` es la transcripción del texto. No sustituye las figuras.
- `diagramas/` explica qué se reconstruyó y qué falta.

Los tipos físicos de cada motor no se deciden en esta entrega. El supuesto 15 del documento los deja para las migraciones de la Entrega II.
