# E2-P2-09 session/token statechart

Scratch run of `/statechart` for the Auth session machine (PORTS-TESTS C3.5 + locked Auth).

Regenerate from a scratch copy of these files:

```bash
TLA2TOOLS=/path/to/tla2tools.jar JAVA=java \
  node --disable-warning=ExperimentalWarning \
  <statechart-skill>/scripts/statechart.ts Session.tla --view view.mjs --out ./out
```

## Break paths (TLC)

1. **AccessSurvivesLogout** — login, then BUG logout that also kills access. Locked C1 requires refresh revoke only; access lasts to expiry.
2. **AuthenticatedIsConsistent** / **RevokedNeverAuthenticated** — access expires, another device revokes refresh, BUG accepts the old refresh and signs in while store stays revoked.

Correct implementations must reject those BUG paths. Named Vitest cases cover the legal transitions and the rejection of replay/bad logout.

See `chart.mmd` and `report.md`.
