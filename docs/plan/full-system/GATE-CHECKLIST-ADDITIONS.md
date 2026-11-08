# Full-system docs/gate-checklist.md additions

Future sole aggregate writer: agent-wire in FS-GATE. These are NOT prechecked passes. Every module submits unique `<ticket-id>.gate.md` fragment, never overwrites this shared checklist. Definition of done requires evidence, not mere plan existence.

- [ ] Scope: exact77 source IDs, no duplicate/gap/invented meanings; original Inst applicability and FS003 decision recorded; no original graded OP in “deferred” panel.
- [ ] Baseline core17 unchanged; source basic DTO/error/claims regression passing. P2-02 red-spec evidence truthful; P2-06 removes discovery boundary and temporary casts; normal/full CI always runs17.
- [ ] Claim/test/implementation order: recorded `test:` SHA precedes production change; red behavioral output and green pregate output; zero assertion weakening/skips or setup-failure-as-red.
- [ ] Every F4 state transition/error has unique named main-app e2e, HTTP status, unchanged native-state error oracle and applicable physical engine evidence. Success/error/read self-loops all represented.
- [ ] Each module only writes assigned paths; per-ticket gate/ADR fragments avoid shared-file collision; one owner for global router/config/CI/lockfile/trackers. Incremental native wave results recorded, not only standalone screenshots.
- [ ] All common use cases pass same unchanged contract across PG/MySQL/Mongo/Firestore; specialized native suite plus memory reference; no physical proof from memory or mocked HTTP.
- [ ] Required atomic31/35/38/13/44/50/22/66/73/74/75 boundaries actually rollback after native mid-write fault, including charges and fiscal counter; nested local UoW has no independent commits.
- [ ] Concurrency: slots/beds/admissions/doses/stock/cargo/fiscal numbers/payments/dental completion claims have one-winner/idempotence evidence; no negative stock/balance, duplicate invoices or burnt fiscal numbers on failed transactions.
- [ ] Schema: literal new-table columns, source84-arrow FK inventory plus logical manual references, exact constraints/FKs/indexes/validator/rules metadata, scoped source keys, additive state/sidecar migration; no drop/reset/shrink/rewrite baseline.
- [ ] Roles: reception/admin cannot read clinical; qualified validator restriction, own honorarium/patient binding; current role/status read after token minted; no admin-superuser demo bypass. Native GRANT/RLS/views/RBAC/rules denials separately from backend scoping.
- [ ] Encryption evidence native PG restricted column, MySQL file-keyring tablespace, explicit Mongo local CSFLE; no paid provider; actual component/library probe, ciphertext native read, keys absent logs/artifacts. Emulator no production IAM/at-rest claim.
- [ ] Audit fail closed for restricted reads; clinical write audit joins local engine transaction; passwords/tokens/clinical body absent general audit/error logs. No impossible cross-engine audit transaction claim.
- [ ] Referrals: explicit1→3 mapping, minimal purpose-limited identity, outbox crash/replay, delivered-only3→1 snapshots; no coincident numeric-id or arbitrary cross-store read. Independent scope/security gate recorded.
- [ ] Attachments:10MiB limit/MIME+magic/hash/authz/traversal/symlink/error cleanup/crash reconciliation; generated local paths, no public file hosting.
- [ ] Official WHO/Guatemala dose data exact URL/license/version/hash and independent sample tests; missing data is visible blocker not synthetic medical normal. Lab fake ranges labeled synthetic demo.
- [ ] Academic ledger/GTQ tax rounding/discount allocation/snapshot price/counter/payment/annul/day-close tests; zero real PAN/FEL/bank/refund integration, no real monetary transaction.
- [ ] UI every applicable workflow usable Spanish labels/loading/empty/errors; axe+contrast, keyboard/Escape/focus375/768/1440,3-width screenshots, duplicate submit disabled.
- [ ] All4 physical target writes/native-read/zero-other-store and restart survival; synthetic idempotent seeds; no fallback/deployment assumption.
- [ ] npm run pregate and VALIDATE_FULL=1 validate match mandatory CI: lint/docs guards/unit/API/native matrix/Playwright parallel/accessibility and>=80% domain/application coverage; absent service/test/module causes failure, not skip.
- [ ] Spanish document/PDF and demo map77 rows to actual evidence/ADRs/security limitations; final submission is separate externally authorized step, not falsely marked done.
