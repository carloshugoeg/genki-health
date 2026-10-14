# Diagramas de la Entrega I

Las figuras del PDF no viajan en la transcripción. Lo que hay aquí se reconstruyó del texto. No es el PNG original.

## Clave Graphviz ↔ notación Chen (sección 6.1)

Esta clave la fijó el ticket **E1-02**. Los diagramas Chen posteriores (E1-03, E1-04, E1-05) deben copiarla sin inventar otras formas.

| Símbolo (sección 6.1) | Forma Graphviz |
| --- | --- |
| Entidad fuerte (rectángulo) | `shape=box` |
| Entidad débil (rectángulo doble) | `shape=box, peripheries=2` |
| Relación (rombo) | `shape=diamond` |
| Relación identificadora (rombo doble) | `shape=diamond, peripheries=2` |
| Atributo (elipse) | `shape=ellipse` |
| Atributo clave (elipse, texto subrayado) | `shape=ellipse` + etiqueta HTML `<U>…</U>` |
| Clave parcial (elipse punteada, texto subrayado) | `shape=ellipse, style=dashed` + `<U>…</U>` |
| Atributo multivaluado (elipse doble) | `shape=ellipse, peripheries=2` |
| Atributo derivado (elipse punteada) | `shape=ellipse, style=dashed` |
| Atributo compuesto | elipse padre unida a elipses hijas (componentes) |
| Participación parcial (línea simple) | arista `penwidth=1` |
| Participación total (línea doble) | arista `penwidth=3` |
| Cardinalidad 1 · N · M | `headlabel` / `taillabel` junto a la entidad |
| Sin flechas de dirección | `edge [arrowhead=none]` |

Convenciones de archivo:

- Fuente: `chen-6.4.X-<slug>.dot`
- Render: `dot -Tpng chen-….dot -o chen-….png` (PNG al lado del `.dot`)
- Comentario de cabecera: sección cubierta y remisión a esta clave
- Atributos solo de la sección 5. No inventar entidades. Los huecos E1-06 ya están locked en `poteto-mode/decisions/locked.md`; no reabrirlos

## Vistas generales (secciones 6.2 y 6.3)

| Archivo | Qué cubre |
| --- | --- |
| `er-hospital-general.dot` | Notación de Chen, solo las relaciones que enumera la sección 6.2 |
| `er-hospital-general.png` | Render de ese archivo con Graphviz |
| `er-hospital-general.mmd` | Las mismas relaciones en Mermaid |
| `er-centro-pediatrico.dot` | Relaciones propias de la sección 6.3 |
| `er-centro-pediatrico.png` | Render |
| `er-centro-pediatrico.mmd` | Las mismas relaciones en Mermaid |

La arista "corresponde a" del pediátrico es la clave foránea `id_hito` de la sección 7.5. La sección 6.3 no le pone ese nombre.

## Diagramas Chen detallados (sección 6.4)

| Archivo | Sección | Ticket |
| --- | --- | --- |
| `chen-6.4.1-paciente-expediente.dot` (+ `.png`) | 6.4.1 Paciente y expediente | E1-02 |
| `chen-6.4.2-agenda-consulta-signos.dot` (+ `.png`) | 6.4.2 Agenda, consulta y signos | E1-02 |
| `chen-6.4.3-diagnostico-tratamiento-receta.dot` (+ `.png`) | 6.4.3 Diagnóstico, tratamiento y receta | E1-02 |
| `chen-6.4.4-hospitalizacion.dot` (+ `.png`) | 6.4.4 Hospitalización y procedimientos | E1-04 |
| `chen-6.4.5-acceso-roles-auditoria.dot` (+ `.png`) | 6.4.5 Acceso, roles y auditoría | E1-02 |

Pendientes: 6.4.6–6.4.8 (E1-05, Jordin), 6.4.9–6.4.11 (E1-03).

## Modelo relacional (secciones 7.4 y 7.5)

Estos archivos siguen el esquema textual de 7.4 / 7.5, actualizado con las decisiones E1-06 (Carlos, 2026-10-14) en `locked.md`.

| Archivo | Módulo |
| --- | --- |
| `rel-acceso.mmd` | Institución, usuario, rol y bitácora |
| `rel-paciente-expediente.mmd` | Paciente y expediente |
| `rel-atencion.mmd` | Cita, consulta, diagnóstico, tratamiento y receta |
| `rel-facturacion.mmd` | Tarifario, factura y pago |
| `rel-personal-insumos.mmd` | Personal, honorarios, insumos y cargos |
| `rel-hospitalizacion.mmd` | Hospital general |
| `rel-pediatrico.mmd` | Extensiones del centro pediátrico |

`int`, `string` y `bool` son marcadores lógicos. El supuesto 15 deja el tipo físico para la Entrega II.

Las claves únicas compuestas están en comentarios al final de cada archivo. Mermaid no las expresa como una sola restricción.
