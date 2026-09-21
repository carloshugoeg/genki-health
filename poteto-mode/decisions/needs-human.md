# Needs a human

Agents do not close these. Carlos or Jordin decides. Until then, diagrams and the transcription follow the section each ticket names, and they do not "fix" the other section.

These gaps were found by comparing the transcribed PDF. They are not new requirements.

1. `PROFESIONAL` in sección 5.1 has `id_tipo_personal`, `modalidad_contrato`, and `fecha_ingreso`. The textual schema in sección 7.4 omits them. Sección 7.6 still describes `PROFESIONAL.id_tipo_personal` as a foreign key.
2. `CAMA` in sección 5.2 has `tipo_cama` and `codigo_servicio`. Sección 7.4 has `id_cama`, `id_servicio`, `codigo`, and `estado` only.
3. `PACIENTE.id_municipio` references `MUNICIPIO`. That catalog is not one of the 58 entities in sección 4.
4. Sección 5.2 says a correction to an evolution note is a new note that references the previous one. Sección 7.4 has no self-reference column on `NOTA_EVOLUCION`.
5. `numero_colegiado` is an alternate unique key in sección 7.4 and optional in sección 5.1. Those two constraints cannot both be a single-column unique key without a partial index. The PDF does not choose the mechanism for PostgreSQL versus MySQL.

Do not add the missing columns to the relational diagrams while this list is open. The diagrams in `rel-*.mmd` follow sección 7.4 and sección 7.5 on purpose.
