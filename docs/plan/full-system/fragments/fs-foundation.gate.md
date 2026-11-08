# FS-FOUNDATION gate fragment

Status: local evidence recorded; not a final FS-GATE check and not merge authority.

## Fail reason template (red)

`fs_foundation_required_behavior` failed because `createEmptyMemoryMaps()` had no `extensions` property on the shared snapshot.

## Commands

```bash
npm ci
npm run build -w @genki/shared
npm test -w @genki/server -- test/full/foundation.test.ts
npm test -w @genki/server -- test/contracts/memory.test.ts
bash scripts/validate.sh
git diff --check
```

## Evidence

- Dependency base: `31b79ccc673eef567003e955a2890d3a5b2308f0` (PR #23 / E2-P2-06)
- `test:` commit: `49123d32a874ef7b1bf7e1ec9e75c227b42cc9a5`
- Raw red: assertion `expected … to have property "extensions"` on `fs_foundation_required_behavior`; see PR body
- Green: foundation 2/2; memory contract suite recorded in journal/PR
- Physical engine: memory/reference only (not physical persistence proof)
- Fixture namespace: in-process memory maps; no patient payload logged

## Unchecked final items

- [ ] Native engine tickets with target metadata and transaction rollback
- [ ] FS-TOOLCHAIN / pregate
- [ ] FS-WIRE / FS-GATE integration
- [ ] Router/second-owner protocol acceptance
