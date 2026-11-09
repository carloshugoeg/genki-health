# ADR-0005 — Clasificación de datos, principales de seguridad y semillas

- Estado: Aceptada
- Fecha: 2026-11-06

## Contexto

La sección 9 de la Entrega I clasifica los datos como públicos, confidenciales y restringidos. Los motores corren en contenedores Docker locales y Firestore en su emulador. La identidad y las sesiones se guardan en el PostgreSQL del hospital. Las semillas no deben dejar credenciales en archivos versionados.

## Decisión

- Roles de la API por institución (`administrador`, `recepcion`, `medico`, `odontologo`, `enfermeria`, `laboratorista`, `auditor`) más un `superadministrador` de evaluación que puede seleccionar institución.
- Principales de base de datos separados para la aplicación, la identidad y los reportes: `genki_app`, `genki_identity` y `genki_report` en PostgreSQL (`server/src/adapters/postgres/security.sql`), `genki_app` y `genki_report` en MySQL (`server/src/adapters/mysql/security.sql`), `genkiApp` y `genkiReporter` en MongoDB (`server/src/adapters/mongodb/security.ts`). El dueño de las migraciones es distinto de los usuarios de ejecución.
- La identidad vive solo en PostgreSQL del hospital; los motores clínicos no guardan hashes de contraseña. Las contraseñas usan Argon2id.
- El cifrado en reposo y a nivel de campo de la Entrega I §9 queda diferido: no se afirma TLS ni cifrado en reposo para los motores locales ni para el emulador.
- Las contraseñas de las semillas se leen solo de la variable de entorno `SEED_PASSWORD`. Las cuentas de demostración son sintéticas (`demo-<institución>-<rol>@example.invalid`).

## Consecuencias

Las semillas calculan el hash de `SEED_PASSWORD` con Argon2id y no reinician contraseñas existentes. El detalle por motor está en la sección 4 del documento comparativo.
