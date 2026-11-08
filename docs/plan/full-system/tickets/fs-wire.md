# FS-WIRE — Single-owner runtime/UI integration of all module manifests

Status: READY only when dependencies are merged/green; no claim this is implemented.
Owner: agent-wire (agent; Carlos PM only, Jordin no programming).
Dependencies: FS-01-PG02, FS-02-PG01, FS-03-PG01, FS-03-MY01, FS-03-MO01, FS-03-FS01, FS-04-PG03, FS-04-MY03, FS-04-MO03, FS-04-FS03, FS-05-PG01, FS-05-MY01, FS-05-MO01, FS-05-FS01, FS-06-PG03, FS-06-MY03, FS-06-MO03, FS-06-FS03, FS-07-PG04, FS-07-MY04, FS-07-MO04, FS-07-FS04, FS-08-PG01, FS-09-PG01, FS-10-PG01, FS-11-PG01, FS-11-MO01, FS-12-MY02, FS-13-MY02, FS-14-MY01, FS-15-MO01, FS-16-MO03, FS-17-FS01, FS-18-FS01, FS-19-FS01, FS-20-PG01, FS-20-MY01, FS-20-MO01, FS-20-FS01, FS-21-PG02, FS-21-MY02, FS-21-MO02, FS-21-FS02, FS-22-PG01, FS-22-MY01, FS-22-MO01, FS-22-FS01, FS-23-PG02, FS-23-MY02, FS-23-MO02, FS-23-FS02, FS-24-PG01, FS-24-MY01, FS-24-MO01, FS-24-FS01, FS-25-PG02, FS-25-MY02, FS-25-MO02, FS-25-FS02, FS-26-PG01, FS-26-MY01, FS-26-MO01, FS-26-FS01, FS-01-H02, FS-02-H01, FS-03-H01, FS-04-H03, FS-05-H01, FS-06-H03, FS-07-H04, FS-08-H01, FS-09-H01, FS-10-H01, FS-11-H01, FS-12-H02, FS-13-H02, FS-14-H01, FS-15-H01, FS-16-H03, FS-17-H01, FS-18-H01, FS-19-H01, FS-20-H01, FS-21-H02, FS-22-H01, FS-23-H02, FS-24-H01, FS-25-H02, FS-26-H01, FS-WAVE-26, FS-BRIDGE, FS-SECURITY-INTEGRATION.
Layer: integration; physical engine: memory/reference or integration as stated.
Estimate: 2–6 active agent-hours plus service/setup/review wait. One PR intent, <=2 added OPs per feature layer, never one PR implementing a full engine/system. If actual patch materially exceeds400 production-behavior LOC, split implementation at these two numbered OP boundaries without changing contracts; reuse parent ticket id suffix `a`/`b`, keep ordered ownership and evidence. This mechanical size split is not a scope cut.

## Context and frozen input
Genki Health, Bases de Datos II, full77 original operations due Nov9. Baseline main observed d89f96b4bec26d834e501da2f4c81b2adad9f2cc; #17 DTO/schema head20417c8951c8466a66691cdca008e415e5ce1067 reported validate-green but protocol gate pending. P2-02..06 not begun at handoff. Core17 and basic DTOs survive unchanged. New full scope supersedes MVP deferrals only; no graded operation silently stubbed. Identity PG+current JWT;1 Hospital PG,2 pediatric MySQL,3 lab Mongo,4 dental Firestore emulator. Synthetic data and free local compose only. No app work was done by plan author.

Read repo AGENTS/DoD, then exact contracts `docs/plan/full-system/contracts/{PORTS-LANES,TYPES-API,SCHEMA,STATECHARTS,SECURITY-FREE}.md` and `entities.json`, `schema-additions.json`, `operations.json`. Foundation copies delivered files first from `/workspace/genki/plan/2026-11-05/full-system/`; all downstream tickets depend on that committed pack and need no previous chat. `DECISIONS.md` ADRFS001–014 supplies decision/why/rejected alternatives. Missing prerequisite is a not-ready state, not permission to invent a port. No publish/merge/external message is authorized by this ticket itself.

## Exact create/touch paths
- `server/src/adapters/http/app.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/config/adapter-registry.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/config/compose-memory.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/config/compose-real.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/main.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `web/src/App.tsx` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `web/src/session.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `web/src/styles.css` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `infra/docker-compose.yml` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `infra/firebase/firestore.rules` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `infra/firebase/firestore.indexes.json` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/test/full/wiring.test.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/adapters/memory/full/index.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/adapters/postgres/full/index.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/adapters/mysql/full/index.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/adapters/mongodb/full/index.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `server/src/adapters/firebase/full/index.ts` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `docs/plan/full-system/fragments/fs-wire.gate.md` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `docs/plan/full-system/fragments/fs-wire.decisions.md` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.
- `docs/progress/journal/fs-wire.md` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.

No other shared/router/CI/lockfile/aggregate file may be edited. Per-module repeated paths have one owner and serial chunk dependencies; another module cannot claim them. Foundation and wire handoffs precede later edits to their shared paths. Module migration is layer-owned, aggregate FK finalizer separate. No wildcard grants or clinical DELETE.

## Contracts / DDL / document schema / HTTP

Apply exact assigned F1–F5 contract paragraphs and numbered steps below. Existing basicDTO/error catalog unchanged; no paid storage/provider, real payment, auth claim rewrite or schema reset. New infrastructure fields are labeled in schema-additions; no unstated product decision.

## Setup and red/green commands
Run in future authorized execution checkout, not planning directory. `npm ci` and engine readiness must succeed before behavioral red. Use existing Node22, C5 pinned drivers/tools and env-only local test credentials. No fetch/reset/checkout or deployment occurs in this planning run.

```bash
npm ci
npm run build -w @genki/shared
docker compose --env-file .env -f infra/docker-compose.yml up -d --wait postgres mysql mongodb
# Firestore: start with C5 emulator command/project demo-test-*; never a real Firebase project.
# Phase1 tests only: create tests/fixtures/imports first, then run:
TEST_ENGINES=1 npm test -w @genki/server -- test/full/wiring.test.ts
# Capture actual nonzero behavioral output, commit as test: FS-WIRE red
# Phase2 implement; rerun unchanged tests:
TEST_ENGINES=1 npm test -w @genki/server -- test/full/wiring.test.ts
bash scripts/validate.sh
# After FS-TOOLCHAIN exists, scoped gate uses this module before global wire:
# FULL_MODULE=<slug> npm run pregate
# Final delivery / integration after FS-GATE:
# npm run pregate
# VALIDATE_FULL=1 bash scripts/validate.sh
git diff --check
```
Phase1 missing dependency/script/service/discovery0 is SETUP FAILURE, not red proof. Add test wiring in test-only commit and rerun before production behavior. Test commit must predate code; do not edit/skip/weaken those assertions afterward. If a test is wrong, stop with concrete mismatch evidence for router, not self-approved assertion change. Temporary P2-02 expected-red correction is specified only in F1, it does not exempt these implementation PRs from green applicable tests.

## Named red-first assertions / statechart tests
Primary exact test paths in file list. Use unchanged module contract cases across every required native adapter. E2e names also appear in F4 statechart; engine/core PRs implement same oracle at their layer, UI/main-app evidence not claimed until mounted/rerun on native.
- `fs_wire_required_behavior`
- `fs_wire_failure_preserves_invariants`

Success tests assert exact state/result and actual stored rows/documents; domain/schema/role/foreign/store failures assert stated status and before/after snapshot equality. Read-list empty is not an invented404: use a real foreign parent where route has parent, or query/projection isolation fixture; F4 caveats define legal oracle. Mutation fault is after a real write inside current native transaction, constructor-injected in test only. Exact race tests in F4 apply to appointments, admissions, charge/stock, fiscal counter/payment, referral and dental claims. Never fake counts or conditionally skip unsupported engine; native specialty matrix follows original source Inst.

## Numbered implementation steps
1. Obtain shared-file lock after baseline owners complete overlapping files. Compose all module adapters using same base UoW, roles, audit and resources. Register module HTTP plugins+UI manifests once. Any missing engine/migration/env fails startup, no memory failover.
2. Wire local volumes, worker, encryption plugins/test deps and Firestore role rules prepared by security owners; consume their exact files, do not override their policy.
3. Full navigation lists every source-applicable workflow, no Out-of-scope specialty placeholder; preserve existing basic endpoints/screens and Spanish errors. Separate demo role sessions exercise required workflows rather than administrator superuser.
4. Wire all named F4 e2e to actual main app with4 real targets and physical probes; record native restarts. No cloud deployment/real payments or production-readiness claim.

## Binary acceptance / definition of done
1. Every applicable named assertion above passes on unchanged tests; source/contract field and error status match, no stub endpoint/placeholder feature or silently deferred OP. Normal lint/typecheck/build/validate exit0. Native engine tickets show actual target metadata and transaction rollback; memory pass never counts as physical proof.
2. All state transitions and error loops for this ticket have named e2e in F4. UI ticket passes standalone axe+contrast, Escape+focus and375/768/1440; final FS-WIRE/FS-GATE reruns against physical assigned engines with3-width screenshots and HTTP status assertions. Record partial stage truthfully, do not pre-check final integration.
3. Journal includes exact dependency SHA, `test:` commit SHA, actual red output, green output, commands, physical engine/fixture namespace, paths, pass/fail counts and no secret/patient payload. `git diff --check`0. Independent agent reruns same applicable commands; no red evidence/no PR gate.
4. Ticket `.gate.md` fragment includes the fail reason+template test, commands/evidence and unchecked final items. `.decisions.md` has decision/why/rejected alternatives, linked ADR IDs. Central gate/DECISIONS/tracker changes belong sole wire owner, not simultaneous module PR edits.
5. Future PR body: Ticket,Why,What changed,Scope,Tradeoffs,Blast radius,Verification,Checklist. Protocol-change requires existing router-approved review/CI gates. Local work/ticket completion is not permission to push/merge or claim Carlos approved. Never print secrets, contact third parties, install paid infrastructure or perform a real payment.

## Out of scope
Other module/OP/layer not explicitly named, core17 rewrites, baseline DTO/claim renames, replacing SQL with generic JSON, ORM, engine fallback, clinical DELETE, special false-success stub, global router/config/CI/lockfile edits outside sole owner scope, managed deployment/paid upgrade/real account money. Out-of-scope here means assigned to other indexed tickets, NOT deferred from full-system delivery.
