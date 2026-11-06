# Gate checklist (Entrega II)

Evidence is filled only when the matching ticket reaches that gate. Do not pre-check a later ticket. Record actual commands and results. Never write a predicted pass.

Protocol-change files (`AGENTS.md`, CI workflows, `ports/` interfaces, initial migrations under the frozen contracts) require the `protocol-change` label and both owners' approval before merge.

## Gates

- **G0 repo truth:** #8 content integrated; #9 rebased content integrated; AGENTS E2 override, exact adopted assumptions and tracker rows consistent. E1-05 independent. Neither merge was performed by this planning task.
  - Evidence (E2-P0-01, 2026-11-06 America/Guatemala): branch `chore/T-E2-P0-01-repo-truth` created from pinned #9 head `6b6a58167d65bbc1f2ca06c88de706efd074da8f`, rebased onto `origin/main` at `0bda4f7` (merged #8). Shared branch `cursor/e2-01-app-scaffold-6295` was not rewritten. `node --test scripts/test/repo-truth.test.mjs` red after the test commit, then green after implementation. `bash scripts/validate.sh` recorded in the journal.
  - Evidence (E2-P0-02, 2026-11-06 America/Guatemala): branch `docs/T-E2-P0-02-synchronize` from `origin/main` at `f019133` (merged #10). Trackers, PROJECT-DESC locked engine table, governance pointers, and incomplete-adapter matrix synchronized. `node --test scripts/test/tracker-sync.test.mjs` red after the test commit (`36398b171414b122abd61683390402f7e911cdf6`), then green after implementation. `bash scripts/validate.sh` recorded in the journal. Shared branch `cursor/e2-01-app-scaffold-6295` was not rewritten.
- **G1 base CI on main:** journal tests (PR + main push), install/lint/format/strict typecheck/depcruise/unit/API/web build; owner records protection capabilities and required check names. No assumption private repo protection is enabled.
  - Evidence: pending later ticket.
- **G2 memory:** all17 unchanged contract cases; every auth/expediente transition named in C3.5; strict unknown input rejection, cross-institution isolation, coverage≥80% domain/application; validate.sh green.
  - Evidence: pending later ticket.
- **G3 SQL:** actual migration metadata matches C4; each runtime app role passes same suite, forced rollback after a real write, FK errors; least-privilege app/report/identity denial tests; no migration owner masquerading as runtime role.
  - Evidence: pending later ticket. Security: least-privilege role denial tests live here.
- **G4 documents:** authenticated Mongo rs0 validators/indexes+suite+roles; Firestore emulator suite/rules/backend-scoping independently green; no unbounded patient history arrays; Admin bypass limitation recorded.
  - Evidence: pending later ticket. Security: deny-by-default Firestore rules and Mongo collection roles live here.
- **G5 integrated demo:** same five screens; Playwright parameterized x4, real native read proves one physical target and zero others, API restart survival, fake seeds repeat idempotently, no hardcoded tracked credentials or memory fallback.
  - Evidence: pending later ticket. Security: no hardcoded credentials or JWT secrets in tracked files.
- **G6 full CI:** stable validate/contract matrix/e2e checks, coverage80, journal safe on main; VALIDATE_FULL=1 local gate matches CI and fails if engine unavailable.
  - Evidence: pending later ticket.
- **G7 document/export:** ten Spanish note sections, rubric mapping/source/evidence, scoped limitations, readable HTML/PDF,8-minute reproducible demo; all artifacts sanitized.
  - Evidence: pending later ticket.
- **G8 handoff:** final trackers truthfully state bounded MVP done, deferred list retained, all46 ticket statuses consistent; agents rehearse; Carlos handles final submission as PM/approver. Record actual submission separately, never pre-check it.
  - Evidence: pending later ticket.
