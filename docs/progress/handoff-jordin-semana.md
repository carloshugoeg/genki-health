# Handoff para Jordin (semana Entrega I)

Documento para Héctor Jordin Adolfo García Coyoy y su agente Claude. No hace falta leer el chat de Carlos/Cursor.

Fecha: 2026-10-14 (actualización E1-06). Autor del trabajo: Carlos Hugo Escobar Gómez / Cursor.

---

## Qué ya está hecho

### E1-02 (merged)

Carlos completó **E1-02** (diagramas Chen del núcleo clínico). **Fusionado en `main`** vía PR #3.

| Sección | Fuente | PNG |
| --- | --- | --- |
| 6.4.1 | `docs/entregas/entrega-1/diagramas/chen-6.4.1-paciente-expediente.dot` | mismo nombre `.png` |
| 6.4.2 | `docs/entregas/entrega-1/diagramas/chen-6.4.2-agenda-consulta-signos.dot` | `.png` |
| 6.4.3 | `docs/entregas/entrega-1/diagramas/chen-6.4.3-diagnostico-tratamiento-receta.dot` | `.png` |
| 6.4.5 | `docs/entregas/entrega-1/diagramas/chen-6.4.5-acceso-roles-auditoria.dot` | `.png` |

Clave de notación (obligatoria para copiar):

- `docs/entregas/entrega-1/diagramas/README.md` → sección **«Clave Graphviz ↔ notación Chen (sección 6.1)»**

Bitácora: `docs/progress/journal/2026-09-24-e1-02.md`.

### E1-04 (in review — Carlos)

Carlos reclamó y dibujó **E1-04** (hospitalización, Hospital general). Estado: **in review** (PR abierto; *done* solo al fusionar).

| Sección | Fuente | PNG |
| --- | --- | --- |
| 6.4.4 | `docs/entregas/entrega-1/diagramas/chen-6.4.4-hospitalizacion.dot` | `.png` |

Bitácora: `docs/progress/journal/2026-09-25-e1-04.md`.

---

## Notación Chen que debes copiar (E1-05)

No inventes otras formas Graphviz. Copia la tabla del README. Resumen operativo:

1. Entidad fuerte → `shape=box`
2. Entidad débil → `shape=box, peripheries=2`
3. Relación → `shape=diamond`
4. Relación identificadora → `shape=diamond, peripheries=2`
5. Atributo → `shape=ellipse`
6. Clave → elipse + `<U>nombre</U>`
7. Clave parcial → elipse `style=dashed` + `<U>…</U>`
8. Multivaluado → elipse `peripheries=2`
9. Derivado → elipse `style=dashed`
10. Participación total → arista `penwidth=3`; parcial → `penwidth=1`
11. Cardinalidad → `headlabel` / `taillabel` (`1`, `N`, `M`)
12. `edge [arrowhead=none]`
13. Cabecera del `.dot` con la sección y remisión al README
14. Render: `dot -Tpng archivo.dot -o archivo.png` y commit del PNG al lado
15. Atributos solo de la sección 5 (para E1-05: **sección 5.3**). Nada nuevo. E1-06 ya está locked; no reabras esos huecos en `rel-*.mmd`

Nombres de relación del núcleo (para no desviarte si reusas entidades compartidas): Posee, Declara, Contiene, Se concreta en, Mide, Produce, Origina, Emite, Detalla. En acceso: Cuenta, Asigna, Otorga, Audita, Credencial. En hospitalización (E1-04): Contiene, Aloja, Documenta, Incluye, Clasifica.

---

## Qué debe hacer Jordin a continuación (E1-05)

**E1-02 ya está en `main`.** Puedes empezar **E1-05** en paralelo con E1-03 / E1-04. No robes E1-03 ni E1-04 (E1-04 es de Carlos).

Ticket: `poteto-mode/queue/tickets/e1-05-chen-pediatrico.md`

Archivos a crear:

- `docs/entregas/entrega-1/diagramas/chen-6.4.6-responsable-perinatal.dot` (+ PNG)
- `docs/entregas/entrega-1/diagramas/chen-6.4.7-crecimiento.dot` (+ PNG)
- `docs/entregas/entrega-1/diagramas/chen-6.4.8-vacunacion.dot` (+ PNG)
- Entradas en el README de diagramas

Criterios que no puedes omitir (del ticket):

- **6.4.6:** participación total de `PACIENTE` en Representa a; no hay expediente sin responsable; `ANTECEDENTE_PERINATAL` es extensión débil 1:1 de `EXPEDIENTE`
- **6.4.7:** `edad_meses`, percentiles y puntuaciones Z son atributos **almacenados**, no derivados (sección 8.4 / `version_referencia`)
- **6.4.8:** `DOSIS_VACUNA` entidad débil; clave parcial `numero_dosis` con expediente y vacuna
- Vista general de apoyo (no sustituye el ticket): `er-centro-pediatrico.dot`

### Cómo reclama Claude vía poteto-mode

1. Leer `AGENTS.md`, `poteto-mode/queue/NOW.md`, `locked.md`, `needs-human.md`, el ticket, `definition-of-done.md`
2. E1-05 es de Jordin; reclámalo cuando nadie más lo tenga *In Progress*. `NOW.md` puede seguir en E1-03 mientras trabajas en paralelo
3. En `docs/progress/TASKS.md`: Status `In Progress`, Owner `Héctor Jordin … / Claude`, fecha, branch. **Commit solo del claim** antes del resto
4. Branch: `docs/e1-05-chen-pediatrico` (convención Entrega I)
5. Hacer el ticket; no empezar otro en la misma sesión
6. Journal `docs/progress/journal/YYYY-MM-DD-e1-05.md`
7. Misma PR: Status del ticket, filas + rollup de `feature-map.md`, `NOW.md` si aplica
8. Abrir PR; el ticket solo se mueve a *done* al merge

---

## Estado de Carlos (esta semana)

| Ticket | Owner | Estado | Notas |
| --- | --- | --- | --- |
| E1-02 | Carlos / Cursor | done | Merged PR #3; notación fijada |
| E1-03 | either | now en cola | No reescribir la clave Graphviz |
| E1-04 | Carlos / Cursor | done | Merged PR #4; hospitalización 6.4.4 |
| E1-05 | Jordin / Claude | backlog | **Tu trabajo**; paralelo OK |
| E1-06 | Carlos / Cursor | in review | **Cerrado por Carlos (2026-10-14)** — no reabrir |
| E2-01 | either | future | Fuera de alcance Entrega I |

Cola viva: `poteto-mode/queue/NOW.md` (apunta a E1-03). Mapa: `poteto-mode/feature-map.md`.

---

## E1-06 cerrado (Claude: no reabrir)

Carlos locked the five conflicts on 2026-10-14. Source of truth: `poteto-mode/decisions/locked.md` (E1-06 section). Struck list: `poteto-mode/decisions/needs-human.md`.

| # | Choice | Effect for Claude |
| --- | --- | --- |
| PROFESIONAL | B | Do not add `id_tipo_personal` / `modalidad_contrato` / `fecha_ingreso` to `rel-*.mmd` |
| CAMA | A | Relational already gets `tipo_cama` + `codigo_servicio` |
| MUNICIPIO | A | Entity inventory + model include `MUNICIPIO` |
| NOTA_EVOLUCION | A | Optional `id_nota_anterior` in relational |
| `numero_colegiado` | coordinator rec. | Required iff `requiere_colegiado`; else `NULL`; UNIQUE among non-null; DDL Entrega II |

For **E1-05** Chen work: still follow sección 5.3 attributes. Do not invent further clinical rules. Do not “fix” E1-06 again.

---

## Fuera de alcance

- Andamiaje de aplicación, ORM, entidades de código, Entrega II (E2-01)
- Reabrir o reinterpretar E1-06
- Implementar E1-03 o E1-05 en nombre del otro
