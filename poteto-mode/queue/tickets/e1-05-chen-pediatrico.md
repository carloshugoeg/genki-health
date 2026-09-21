# E1-05 Dibujar los diagramas Chen del centro pediátrico

- Status: backlog
- Owner: Jordin
- Agent: Claude
- Depends on: E1-02
- Needs human: no

## What to build

- `docs/entregas/entrega-1/diagramas/chen-6.4.6-responsable-perinatal.dot`
- `docs/entregas/entrega-1/diagramas/chen-6.4.7-crecimiento.dot`
- `docs/entregas/entrega-1/diagramas/chen-6.4.8-vacunacion.dot`
- PNG renders and README entries

## Acceptance criteria

- 6.4.6 shows total participation of `PACIENTE` in Representa a. No expediente without a responsable. `ANTECEDENTE_PERINATAL` is a weak 1:1 extension of `EXPEDIENTE`.
- 6.4.7 shows `edad_meses`, percentiles, and Z scores as stored attributes, not derived. Sección 8.4 says they are historical values against `version_referencia`.
- 6.4.8 shows `DOSIS_VACUNA` as a weak entity. Partial key `numero_dosis`, identified together with the expediente and the vaccine.
- Attributes match sección 5.3.
- `dot -Tpng` exits 0 for each file.

## Out of scope

- Hospitalización, billing, and the document model for MongoDB or Firebase.
- MySQL DDL. Supuesto 15.

## Links

- Secciones 6.3, 6.4.6, 6.4.7, 6.4.8, and 5.3 of the transcription
- `docs/entregas/entrega-1/diagramas/er-centro-pediatrico.dot` is the overview only
