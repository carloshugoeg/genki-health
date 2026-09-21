# E1-02 Dibujar diagramas Chen del núcleo clínico

- Status: now
- Owner: either
- Agent: either
- Depends on: none
- Needs human: no

## What to build

Add Graphviz sources, using Chen notation from sección 6.1, for the shared clinical core.

- `docs/entregas/entrega-1/diagramas/chen-6.4.1-paciente-expediente.dot`
- `docs/entregas/entrega-1/diagramas/chen-6.4.2-agenda-consulta-signos.dot`
- `docs/entregas/entrega-1/diagramas/chen-6.4.3-diagnostico-tratamiento-receta.dot`
- `docs/entregas/entrega-1/diagramas/chen-6.4.5-acceso-roles-auditoria.dot`

Render each with `dot -Tpng` and commit the PNG beside the source. Add the four files to `docs/entregas/entrega-1/diagramas/README.md`.

This ticket also fixes the notation the later Chen tickets copy. Put a short key of the Graphviz shapes you used in the diagram README, mapped to the symbols in sección 6.1.

## Acceptance criteria

- 6.4.1 shows `PACIENTE` and `EXPEDIENTE` with total participation on both ends of Posee. `CONTACTO_EMERGENCIA` is a weak entity. `edad` is derived from `fecha_nacimiento` and is not stored. `telefono` is multivalued at the conceptual level. `nombre` is composite and splits into the four stored name parts from sección 5.1.
- 6.4.2 shows `SIGNOS_VITALES` as a weak entity of `CONSULTA`. BMI is derived from weight and height and is not stored.
- 6.4.3 shows Detalla as the only many-to-many, between `RECETA` and `MEDICAMENTO`. Dose, route, frequency, duration, quantity, and instructions hang on the relationship, not on either entity.
- 6.4.5 shows the many-to-many between `ROL` and `PERMISO`. `hash_contrasena` is present on `USUARIO`.
- Every attribute appears in sección 5. No attribute from `needs-human.md` is added to close a gap.
- Relationship names match sección 6.4.
- `dot -Tpng` exits 0 for each file.
- No SQL, no application code, no new entity.

## Out of scope

- Secciones 6.4.4 and 6.4.6 through 6.4.11.
- Changing `rel-*.mmd`.
- Choosing a side on `poteto-mode/decisions/needs-human.md`.

## Links

- `docs/entregas/entrega-1/analisis-y-modelo-relacional.md` secciones 5.1, 6.1, 6.4.1, 6.4.2, 6.4.3, 6.4.5
- `docs/entregas/entrega-1/entrega-i.pdf`
- `docs/entregas/entrega-1/diagramas/er-hospital-general.dot` is the overview only. It does not satisfy this ticket.
