-- FS-01-PG02: additive identity columns for password change / reset.
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
