# Firebase emulator (Clínica odontológica)

Jordin owns the Firebase adapter. This folder only pins emulator ports for local and CI use.

```bash
# Requires firebase-tools when that work starts.
firebase emulators:start --only auth,firestore --project genki-health-demo
```

Do not point Phase 0 at a real Firebase project.
