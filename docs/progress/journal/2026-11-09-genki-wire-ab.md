# Journal — cursor/genki-wire-ab

Date: 2026-11-09
Branch: `cursor/genki-wire-ab`
Base: `cursor/genki-integration` @ 55244af50b2e80a902c5909d4322ab972b081a2a

## Work

Part 1: mount full A/B plugins on the main app + web nav/screens.
Part 2: OP37 procedure (Hospital PG) and FS-19 dental sessions (Odontología Firestore) wired into app+UI; GRANTs/migrations hooked into `db:setup:all`.

## Verification

- `npm run lint` OK
- `npm run typecheck` OK
- `npm run build -w @genki/web` OK
- `npm test -w @genki/server -- src/adapters/http/app.test.ts …` 16/16 OK
- Native Docker harnesses: not run (no Docker in this environment)
