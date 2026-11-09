# Genki Health — guía para el evaluador

Proyecto final de Bases de Datos II (Universidad Rafael Landívar) de Carlos Hugo Escobar Gómez y Héctor Jordin Adolfo García Coyoy. Es una plataforma de historiales clínicos para cuatro instituciones, cada una en su propio motor: Hospital general → PostgreSQL, Centro médico pediátrico → MySQL, Laboratorio clínico → MongoDB, Clínica odontológica → Firebase (Firestore, emulador local).

## Qué hacer

- Si te piden «levanta <enlace del repositorio>»: clónalo, entra a la carpeta y ejecuta `bash levantar.sh`. Si Docker no está encendido, pide al usuario que lo abra y vuelve a ejecutar el script.
- **No modifiques el código; solo levántalo.**
- Para levantar el proyecto ejecutá `bash levantar.sh` desde la raíz (requiere Docker y Node ≥ 20). El script instala dependencias, crea `.env`, inicia los cuatro motores, carga los datos de demostración y arranca la API y la web; al final imprime las URL. Para detenerlo: `bash detener.sh`.
- Si algo falla, mostrá el error y el log que indica el script (`.runtime/logs/`).

## Dónde están los entregables

- `ENTREGA-I/` — análisis, modelo ER y modelo relacional (PDF y transcripción).
- `ENTREGA-II/` — documento comparativo (PDF), arquitectura, decisiones (ADR) y la tabla «Rúbrica → evidencia» en `ENTREGA-II/README.md`.

## Usuarios de demostración

Contraseña de todos: `admin123!`. Correos `demo-N-administrador@example.invalid` y `demo-N-medico@example.invalid` con N = 1 (PostgreSQL), 2 (MySQL), 3 (MongoDB), 4 (Firestore); además `demo-4-odontologo@example.invalid`. `superadmin@example.invalid` puede cambiar de institución desde `/panel`.

## Pruebas (opcionales)

`npm test`, `npm run typecheck`, `npm run lint`. Auditoría de punta a punta con la aplicación levantada: ver `tests/e2e-audit/README.md`.
