# Gate checklist (Entrega II)

Evidence is filled only when the matching ticket reaches that gate. Do not pre-check a later ticket. Record actual commands and results. Never write a predicted pass.

Protocol-change files (`AGENTS.md`, CI workflows, `ports/` interfaces, initial migrations under the frozen contracts) require the `protocol-change` label and both owners' approval before merge.

## Gates

- **G0 repo truth:** #8 content integrated; #9 rebased content integrated; AGENTS E2 override, exact adopted assumptions and tracker rows consistent. E1-05 independent. Neither merge was performed by this planning task.
  - Index install (E2-P1-04, 2026-11-06 America/Guatemala): executable ticket registry `docs/plan/tickets/index.json` and populated `docs/plan/E2-EXECUTABLE.md` (assumptions A1–A15, schedule windows, dependency table, contract + gate links). Structural `node --test scripts/test/plan-paths.test.mjs` red then green. This does not re-run #8/#9 merges.
  - Evidence (E2-P0-01, 2026-11-06 America/Guatemala): branch `chore/T-E2-P0-01-repo-truth` created from pinned #9 head `6b6a58167d65bbc1f2ca06c88de706efd074da8f`, rebased onto `origin/main` at `0bda4f7` (merged #8). Shared branch `cursor/e2-01-app-scaffold-6295` was not rewritten. `node --test scripts/test/repo-truth.test.mjs` red after the test commit, then green after implementation. `bash scripts/validate.sh` recorded in the journal.
  - Evidence (E2-P0-02, 2026-11-06 America/Guatemala): branch `docs/T-E2-P0-02-synchronize` from `origin/main` at `f019133` (merged #10). Trackers, PROJECT-DESC locked engine table, governance pointers, and incomplete-adapter matrix synchronized. `node --test scripts/test/tracker-sync.test.mjs` red after the test commit (`36398b171414b122abd61683390402f7e911cdf6`), then green after implementation. `bash scripts/validate.sh` recorded in the journal. Shared branch `cursor/e2-01-app-scaffold-6295` was not rewritten.
- **G1 base CI on main:** journal tests (PR + main push), install/lint/format/strict typecheck/depcruise/unit/API/web build; owner records protection capabilities and required check names. No assumption private repo protection is enabled.
  - Evidence (E2-P0-03, 2026-11-06 America/Guatemala): branch `docs/T-E2-P0-03-make` from `origin/main` at `4e02120` (merged #11). Journal gate extracted to `scripts/journal-gate.mjs` (added journal required for `server/`/`web/`/`shared/` changes; merge-base for PRs; `github.event.before` / empty tree for main pushes; `fetch-depth: 0`). `npm run test:protocol` (`node --test scripts/test/*.test.mjs`) wired into `scripts/validate.sh` and CI job `validate`. Required check name stays workflow `ci` / job `validate`. `node --test scripts/test/journal-gate.test.mjs` red after the test commit (`d694628af651087d74b78ad6afbca70cd11fccf4`), then green after implementation. `bash scripts/validate.sh` recorded in the journal. Protected-main policy remains owner-operated only (PR required, checks required, linear history, no force pushes); this ticket did not change repository visibility, branch protection settings, or account permissions. Shared branch `cursor/e2-01-app-scaffold-6295` was not rewritten.
- **G2 memory:** all17 unchanged contract cases; every auth/expediente transition named in C3.5; strict unknown input rejection, cross-institution isolation, coverage≥80% domain/application; validate.sh green.
  - Prerequisite pack (E2-P1-01, 2026-11-06 America/Guatemala): frozen C2/C3 contracts committed on `docs/T-E2-P1-01-commit` (`API.md`, `PORTS-TESTS.md`, `DTO-BASELINE.ts`, pack `e2-mvp-2026-11-05`). Structural `node --test scripts/test/api-spec.test.mjs` red then green. Runtime memory suite evidence remains pending later tickets. Do not treat this pack commit as G2 green.
  - Prerequisite types/schemas (E2-P2-01, 2026-11-07 America/Guatemala): MVP DTOs (`shared/src/mvp.ts`), strict HTTP Zod schemas (`server/src/adapters/http/schemas.ts`), domain `ClinicalError`, and port signatures `ClinicalContext` / `CatalogoRepositoryPort` / `IdentityStorePort` / `AdapterResource`. Named cases in `server/src/adapters/http/schemas.test.ts` red then green (`schemas_reject_unknown_institution`, `schemas_reject_impossible_date`, `schemas_match_dto_keys`, `clinical_error_codes_match_wire_union`). Does not green the 17-case memory suite.
  - Prerequisite contract freeze (E2-P2-02, 2026-11-07 America/Guatemala): C3.4 suite frozen in `server/test/contracts/clinical.contract.ts` (17 named cases including native rollback failures). Opt-in discovery via `CONTRACT_RED=1` / `CONTRACT_READY=1` in `server/vitest.config.ts`. Command `CONTRACT_RED=1 npm test -w @genki/server -- test/contracts/memory.test.ts` recorded red (16 failed / 1 passed) on scaffold memory; baseline `npm test -w @genki/server` stays green with the suite excluded. Expected-red reporter: `npm run test:contract-red` / CI job `contract-red` (separate from `validate`). Does not green G2.
  - Prerequisite memory UoW/registry (E2-P2-03, 2026-11-08 America/Guatemala): snapshot UoW + shared institution state + registry cache. Named cases in `unit-of-work.test.ts` / `adapter-registry.test.ts` red then green. Does not green the 17-case memory suite.
  - Prerequisite memory patient registration (E2-P2-04, 2026-11-08 America/Guatemala): memory alta, guardians, search, and archive. Named cases in `register-paciente.test.ts` / `archive-expediente.test.ts` red (11 failed / 2 passed, exit 1) then green (21 passed with the UoW and registry files; the two application files alone are 13 passed). `CONTRACT_RED=1` memory suite stayed red (8 passed / 9 failed). `npm run test:contract-red` exits 0 and prints `expect-contract-red OK`. `npm run validate` ended `validate.sh OK`. Does not green G2.
  - Prerequisite domain invariants (E2-P2-05, 2026-11-08 America/Guatemala): pure `validateConsulta` in `server/src/domain/consulta.ts` (exactly one principal diagnosis; in-range treatment indexes; treatment per diagnosis; distinct medication ids / non-empty recipe details; start ≤ now; treatment end ≥ start; serialized UTF-8 JSON size ≤ 256 KiB inclusive). Named cases in `server/src/domain/consulta.test.ts` red then green. Does not green the 17-case memory suite or wire closeConsulta.
  - Evidence (E2-P2-06, 2026-11-08 America/Guatemala): memory closed consultation aggregate + test-only close bridge (CCR-HARNESS-001). Shared IdPort sequences across institutions in one harness domain; state-scoped ALS; CIE10 string keys. `npm test -w @genki/server -- test/contracts/memory.test.ts` → 17 passed / 0 failed (exit 0) without CONTRACT_RED. Focused id/UoW/close application tests green. `bash scripts/validate.sh` recorded in the journal. CONTRACT_RED opt-in removed; memory suite is default. Does not claim physical-engine G2 coverage beyond memory.
- **G3 SQL:** actual migration metadata matches C4; each runtime app role passes same suite, forced rollback after a real write, FK errors; least-privilege app/report/identity denial tests; no migration owner masquerading as runtime role.
  - Prerequisite pack (E2-P1-02, 2026-11-06 America/Guatemala): frozen C4a/C4b DDL and `SQL.md` committed on `docs/T-E2-P1-02-commit` (`docs/plan/ddl/postgres.sql`, `docs/plan/ddl/mysql.sql`, `docs/plan/contracts/SQL.md`). Structural `node --test scripts/test/sql-spec.test.mjs` red then green. Specs are not executed against engines in this ticket.
  - [ ] Engine verification pending later adapter/migration tickets (apply C4a/C4b as runtime migrations; role least-privilege; forced rollback; FK error paths). Do not treat this pack commit as G3 green.
  - Infra prerequisite (E2-P3A-01, 2026-11-08 America/Guatemala): loopback Compose + env secrets, `demo-env.sh`, `db:migrate`/`db:bootstrap`/`db:reset:test` guard. `node --test scripts/test/infra.test.mjs` red then green. Gate FAIL at `e410f34` remediated: restored `scripts/test/infra.test.mjs` to `test:` SHA `8ccc6e9` (no post-test format/import/regex edits); raw isolated Compose health log attached on the PR with sha256 + tree SHA. Does not green G3 migrations/roles.
  - Prerequisite MySQL schema/UoW (E2-P3B-01, 2026-11-08 America/Guatemala): C4b InnoDB migration `0001-core`, type mapper, scoped `MysqlUnitOfWork`, `id_counter` for `receta_folio`, catalog list. Named cases in `server/src/adapters/mysql/schema.test.ts` red then green under `TEST_ENGINES=1` against disposable `genki_test_mysql_schema`. Does not green the 17-case mysql suite, patient/consulta repos, or least-privilege roles.
  - Patient slice (E2-P3B-02, 2026-11-08 America/Guatemala): `MysqlPacienteRepository` + harness on disposable `genki_test_mysql_paciente`. Command `TEST_ENGINES=1 npm test -w @genki/server -- src/adapters/mysql/paciente-repository.test.ts` red (`paciente-repository.js` absent, test: SHA `c61c67d209173498af023cab1cca3265ea47729f`, log sha256 `cb55238b8c60a0b44dfa685f23cbe1917061a7aafdee97b6de6796468809d015`) then green (4/4, log sha256 `e363ea14d212b5dafe0b5d1cc2e0e657d1eba6a5c311a4c222a384e60d303a34`). Cases: `mysql_guardians_precede_expediente`, `mysql_registration_failure_rolls_back_guardians`, `mysql_duplicate_document_is_race_safe`, `mysql_archive_hides_active_search`. Does not green the 17-case mysql suite, consulta repo, or least-privilege roles.
  - Evidence: pending later ticket. Security: least-privilege role denial tests live here.
- **G4 documents:** authenticated Mongo rs0 validators/indexes+suite+roles; Firestore emulator suite/rules/backend-scoping independently green; no unbounded patient history arrays; Admin bypass limitation recorded.
  - Prerequisite pack (E2-P1-03, 2026-11-06 America/Guatemala): frozen C5 document/security/seed contract and mapping ADRs committed on `docs/T-E2-P1-03-commit` (`docs/plan/contracts/DOCUMENTS-SECURITY.md`, `docs/plan/contracts/mongodb-schema.json`, ADR-0003/0004/0005). Structural `node --test scripts/test/document-spec.test.mjs` red then green. Specs are not executed against Mongo/Firestore in this ticket.
  - Infra prerequisite (E2-P3A-01, 2026-11-08 America/Guatemala): authenticated single-member Mongo rs0 via `infra/mongodb/start-rs.sh` (keyfile 0600 inside container, primary wait). Compose health requires writable primary. Does not green G4 validators/roles/Firestore rules.
  - [ ] Engine verification pending later adapter tickets (Mongo rs0 validators/roles; Firestore emulator rules/backend scoping; no unbounded patient history arrays; Admin bypass tests). Do not treat this pack commit as G4 green.
  - Evidence: pending later ticket. Security: deny-by-default Firestore rules and Mongo collection roles live here.
- **G5 integrated demo:** same five screens; Playwright parameterized x4, real native read proves one physical target and zero others, API restart survival, fake seeds repeat idempotently, no hardcoded tracked credentials or memory fallback.
  - Evidence: pending later ticket. Security: no hardcoded credentials or JWT secrets in tracked files.
- **G6 full CI:** stable validate/contract matrix/e2e checks, coverage80, journal safe on main; VALIDATE_FULL=1 local gate matches CI and fails if engine unavailable.
  - Evidence: pending later ticket.
- **G7 document/export:** ten Spanish note sections, rubric mapping/source/evidence, scoped limitations, readable HTML/PDF,8-minute reproducible demo; all artifacts sanitized.
  - Evidence: pending later ticket.
- **G8 handoff:** final trackers truthfully state bounded MVP done, deferred list retained, all46 ticket statuses consistent; agents rehearse; Carlos handles final submission as PM/approver. Record actual submission separately, never pre-check it.
  - Prerequisite index (E2-P1-04, 2026-11-06 America/Guatemala): all 46 E2 ticket ids, deps, owners, files, and `created_by` path origins are frozen in `docs/plan/tickets/index.json`. Final G8 tracker close remains E2-P6-03.
  - Evidence: pending later ticket.

## Gate FAIL remediation templates

Copy these when a gate FAIL names the matching reason. Keep the owning branch tip; no rebase or force-push when other agents are stacked.

### post-test edits to test files

**Symptom.** After the ticket's `test:` commit, a later commit reformats, re-escapes, or adds imports in the same test files (Prettier wrap, regex unescape, `node:process` import, and similar).

**Fix.**

1. Identify the `test:` commit SHA for the ticket.
2. Restore every listed test file to that commit's exact bytes: `git checkout <test-sha> -- <path>…`.
3. Re-run the suite against the current implementation. Keep the impl green on the restored assertions.
4. If a restored assertion fails, stop and report. Do not weaken, skip, or rewrite the test to match the impl.
5. If `format:check` or ESLint would rewrite or reject the restored bytes (`no-undef` on Node globals, `no-useless-escape` on intentional regex escapes, Prettier wrap), add only that frozen path to `.prettierignore` and/or `eslint.config.js` `ignores` so tooling cannot mutate the red contract after the fact.

**Not a fix.** Re-running Prettier/ESLint auto-fix on the tests, "equivalent" regex or import edits, or a journal waiver for format-only drift when the gate asked for a restore.

### missing raw runtime health log

**Symptom.** Provision / engine tickets claim Compose (or emulator) Healthy from static protocol tests or a paraphrased journal line, with no raw disposable runtime log on the PR.

**Fix.**

1. On a disposable local VM only, create env once via `bash scripts/demo-env.sh` if `.env` is absent (never commit it).
2. Run an isolated Compose project: `docker compose --env-file .env -f infra/docker-compose.yml up -d --wait postgres mysql mongodb` (set a unique `COMPOSE_PROJECT_NAME`).
3. Capture the full raw stdout+stderr of that command into a file. Record `sha256sum` of the file and the git tree SHA (`git rev-parse 'HEAD^{tree}'`) of the tree the command ran on.
4. Paste the raw log (or an artifact path plus the same bytes) into the PR body with the sha256 and tree SHA. Tear down the Compose project afterward.

**Not enough.** Protocol/`node --test` structural suites alone, paraphrased "Healthy" claims, or a log from a different tree SHA.
