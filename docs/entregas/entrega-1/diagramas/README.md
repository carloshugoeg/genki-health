# Diagramas de la Entrega I

Las figuras del PDF no viajan en la transcripción. Lo que hay aquí se reconstruyó del texto. No es el PNG original.

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

## Modelo relacional (secciones 7.4 y 7.5)

Estos archivos siguen el esquema textual. No rellenan los huecos de `poteto-mode/decisions/needs-human.md`.

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

## Lo que falta

Los diagramas detallados con atributos de la sección 6.4. El ticket en curso es E1-02. La convención de formas Graphviz para la notación de Chen se escribe aquí cuando ese ticket la fije.
