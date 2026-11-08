# Firebase emulator (Clínica odontológica)

Start the Firestore emulator for Odontología, institution 4, on project `demo-genki-health`.

```bash
npx firebase emulators:start --only firestore --project demo-genki-health --config infra/firebase/firebase.json
```

The emulator listens on `127.0.0.1:8080`. The Auth emulator stays off. `singleProjectMode` is false so a later `demo-test` project can share the process.

`firestore.rules` denies every direct client. A reporter whose string `institution_id` matches the institution path can read `reportes/{id}`. Writes stay denied.

`firestore.indexes.json` defines the C5.2 composites for `records` and `consultations`.

Do not point this folder at a real Firebase project.
