# Handoff para Jordin (semana Entrega I)

Documento para Héctor Jordin Adolfo García Coyoy y su agente Claude. No hace falta leer el chat de Carlos/Cursor.

Fecha: 2026-09-24. Autor del trabajo: Carlos Hugo Escobar Gómez / Cursor.

---

## Qué ya está hecho (E1-02)

Carlos reclamó y completó **E1-02** (diagramas Chen del núcleo clínico compartido). Estado del ticket: **in review** (PR abierto; el ticket solo pasa a *done* al fusionar).

Archivos nuevos:

| Sección | Fuente | PNG |
| --- | --- | --- |
| 6.4.1 | `docs/entregas/entrega-1/diagramas/chen-6.4.1-paciente-expediente.dot` | mismo nombre `.png` |
| 6.4.2 | `docs/entregas/entrega-1/diagramas/chen-6.4.2-agenda-consulta-signos.dot` | `.png` |
| 6.4.3 | `docs/entregas/entrega-1/diagramas/chen-6.4.3-diagnostico-tratamiento-receta.dot` | `.png` |
| 6.4.5 | `docs/entregas/entrega-1/diagramas/chen-6.4.5-acceso-roles-auditoria.dot` | `.png` |

Clave de notación (obligatoria para copiar):

- `docs/entregas/entrega-1/diagramas/README.md` → sección **«Clave Graphviz ↔ notación Chen (sección 6.1)»**

Bitácora de sesión: `docs/progress/journal/2026-09-24-e1-02.md`.

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
15. Atributos solo de la sección 5 (para E1-05: **sección 5.3**). Nada nuevo. No edites `rel-*.mmd` para “arreglar” `needs-human.md`

Nombres de relación del núcleo (para no desviarte si reusas entidades compartidas): Posee, Declara, Contiene, Se concreta en, Mide, Produce, Origina, Emite, Detalla. En acceso: Cuenta, Asigna, Otorga, Audita, Credencial (alineados con `rel-acceso.mmd`).

---

## Qué debe hacer Jordin a continuación (E1-05)

**No empieces E1-05 hasta que E1-02 esté fusionado en `main`.** `poteto-mode/handoff.md` exige dependencias fusionadas. E1-04 (hospitalización, Carlos) y E1-05 pueden ir en paralelo después del merge.

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
2. Si `NOW.md` aún apunta a E1-03 u otro ticket: **no robes** un ticket cuyo owner sea Carlos. E1-05 es de Jordin; reclámalo cuando sea el de `NOW.md` **o** cuando el backlog diga trabajo en paralelo post-merge de E1-02 y nadie más lo tenga *In Progress*
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
| E1-02 | Carlos / Cursor (era either) | in review | Notación fijada |
| E1-03 | either | now en cola | No empezar hasta merge de E1-02 si necesitas base limpia; no reescribir la clave Graphviz |
| E1-04 | Carlos / Cursor | backlog | Tras merge de E1-02; paralelo con E1-05 |
| E1-05 | Jordin / Claude | backlog | Tu trabajo; paralelo con E1-04 tras merge |
| E1-06 | either | blocked | Solo humanos |
| E2-01 | either | future | Fuera de alcance Entrega I |

Cola viva: `poteto-mode/queue/NOW.md` (hoy apunta a E1-03). Mapa: `poteto-mode/feature-map.md`.

---

## Bloqueado: E1-06 (no elijas lado)

Hay cinco conflictos entre sección 5 y sección 7.4. Los agentes **no** deciden. Detalle y guía para humanos:

- Lista viva: `poteto-mode/decisions/needs-human.md`
- Brief para decidir: `docs/progress/decision-brief-e1-06.md`

Mientras tanto: diagramas Chen siguen la sección 5 cuando el ticket lo pide; `rel-*.mmd` siguen 7.4/7.5 a propósito.

---

## Fuera de alcance

- Andamiaje de aplicación, ORM, entidades de código, Entrega II (E2-01)
- Resolver E1-06 eligiendo una versión del PDF
- Implementar E1-04 o E1-05 en nombre del otro
