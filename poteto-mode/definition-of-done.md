# Definition of done

A ticket is done when every acceptance criterion is true and the handoff steps are done.

For an Entrega I diagram ticket, all of these are required.

- The new source file is in `docs/entregas/entrega-1/diagramas/`.
- It uses the symbols from sección 6.1. Strong entity, weak entity, relationship, identifying relationship, key attribute, partial key, multivalued attribute, derived attribute, composite attribute, partial participation, total participation, cardinality.
- Every entity and attribute on the diagram is already in sección 4 or sección 5. Nothing new.
- Relationship names match the names in the section the ticket cites.
- `dot -Tpng` succeeds when Graphviz is installed, and the PNG is committed next to the source.
- The diagram README lists the new files.
- A journal file exists for the session.
- No application code, no SQL migrations, no new entity.

For any ticket, these are also required.

- Spanish section names are unchanged.
- Locked decisions are untouched.
- `needs-human` items are untouched.
- The PR description names the ticket id and the next ticket.
- The matching rows and the rollup in `feature-map.md` match this ticket, and `queue/NOW.md` is the current ticket.
