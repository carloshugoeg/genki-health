# FS-FOUNDATION decisions fragment

Local adoption notes. Central `DECISIONS.md` holds ADR FS-001..014; wire folds later evidence.

| Decision | Why | Rejected |
| --- | --- | --- |
| One `MemoryMaps.extensions` map of namespaced buckets on the same clone/publish snapshot | F1 + Nov8 amendment; rollback must cover base+module together | Second MemoryInstitutionState / second UoW; per-module mutex |
| `full-state.ts` as register-once helper over that field | Modules inject maps without owning snapshot lifecycle | Replacing `state.ts` / `MemoryUnitOfWork` |
| Type-only `server/src/ports/full/*` and `@genki/shared/full/*` | F1/F2 declarations; no throwing stubs or manufactured success | Runtime stub adapters in foundation |
| Package export `./full/*` with `default` condition | Node resolve + ESM import for module consumers | Root `shared/src/index.ts` barrel edits by modules |

Linked ADRs: FS-001, FS-002, FS-005, FS-012 (see root `DECISIONS.md`).
