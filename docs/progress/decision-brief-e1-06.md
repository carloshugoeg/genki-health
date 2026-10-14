# Brief de decisión — E1-06 (atributos en conflicto)

**Estado: cerrado.** Carlos decidió el 2026-10-14. Resultados en `poteto-mode/decisions/locked.md`. Este brief queda como historial de la pregunta; no volver a elegir.

Para Carlos Hugo Escobar Gómez y Héctor Jordin Adolfo García Coyoy. Los agentes **no** eligen. Este brief solo aclaraba qué había que decidir.

Fuente de los huecos: comparación de la transcripción del PDF (`docs/entregas/entrega-1/analisis-y-modelo-relacional.md`). Lista operativa: `poteto-mode/decisions/needs-human.md`.

## Regla actual (mientras no haya decisión)

| Superficie | Qué sigue |
| --- | --- |
| Diagramas Chen (sección 6.4) | Atributos de la **sección 5** del ticket correspondiente |
| Modelo relacional `rel-*.mmd` | Texto de **sección 7.4 / 7.5** |
| Agentes | No añadir columnas a `rel-*.mmd` para “cerrar” el hueco; no inventar mecanismos (índices parciales, etc.) |

## Las cinco decisiones

### 1. `PROFESIONAL`: columnas de sección 5.1 ausentes en 7.4

- **5.1 tiene:** `id_tipo_personal`, `modalidad_contrato`, `fecha_ingreso`
- **7.4 omite** esas tres columnas
- **7.6** sigue hablando de `PROFESIONAL.id_tipo_personal` como FK

**Pregunta para humanos:** ¿Se incorporan las tres columnas al esquema relacional (y a `rel-*.mmd`), o se deja 7.4 como está y se corrige 7.6 / la prosa?

### 2. `CAMA`: `tipo_cama` y `codigo_servicio`

- **5.2 tiene:** `tipo_cama`, `codigo_servicio` (además del resto)
- **7.4 tiene:** `id_cama`, `id_servicio`, `codigo`, `estado` solamente

**Pregunta:** ¿Chen 6.4.4 (E1-04) ya puede mostrar `tipo_cama` y `codigo_servicio` (sí, el ticket E1-04 lo pide desde 5.2). ¿El relacional debe ganar esas columnas o quedarse en 7.4?

### 3. `PACIENTE.id_municipio` → `MUNICIPIO`

- **5.1 / paciente:** FK `id_municipio`
- **Sección 4:** `MUNICIPIO` no está entre las 58 entidades

**Pregunta:** ¿Se añade `MUNICIPIO` al inventario de entidades, se trata como catálogo externo no modelado, o se elimina la FK del paciente?

### 4. Autoreferencia en `NOTA_EVOLUCION`

- **5.2:** una corrección es una nota nueva que referencia la anterior
- **7.4:** no hay columna de auto-referencia

**Pregunta:** ¿Se añade FK opcional a la nota previa en el relacional, o las correcciones quedan solo como regla de negocio sin columna? (Los Chen de hospitalización deben decir que las notas son append-only **sin** inventar la columna mientras esto esté abierto — ver E1-04.)

### 5. `numero_colegiado` único vs opcional

- **7.4:** alternate unique key
- **5.1:** opcional (no todo el personal se colegia)
- Un UNIQUE de una sola columna no admite varios NULL de la misma forma en todos los motores; el PDF no elige el mecanismo PostgreSQL vs MySQL

**Pregunta:** ¿Unique parcial / filtrado, unique compuesto con tipo de personal, o colegiado obligatorio solo cuando `TIPO_PERSONAL.requiere_colegiado` (y cómo se expresa en cada motor)? Eso puede esperar a Entrega II DDL (supuesto 15) si así lo acuerdan, pero hay que dejarlo escrito.

## Cómo registrar la decisión

1. Acuerden Carlos + Jordin (reunión o mensaje).
2. Escriban el resultado en `poteto-mode/decisions/locked.md`.
3. Cierren o tachen el ítem en `needs-human.md`.
4. Ajusten `rel-*.mmd` y/o la prosa de la Entrega I en un ticket explícito — no dejen que un agente “adivine” en un PR de diagramas.

Ticket de cola: `poteto-mode/queue/tickets/e1-06-decision-humana.md` (blocked hasta que haya decisión humana).
