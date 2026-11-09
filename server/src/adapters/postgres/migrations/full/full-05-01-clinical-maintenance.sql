-- Mantenimiento de historiales (cierre OP-31, corrección/anulación con bitácora).
-- Additive and idempotent: widens three CHECKs to the Entrega I status domains so an annulment
-- is a status change, never a DELETE. No new tables or columns; BITACORA already exists.
--   DIAGNOSTICO.tipo   presuntivo, definitivo, descartado   (anular -> descartado)
--   TRATAMIENTO.estado activo (= vigente), finalizado, suspendido (anular -> suspendido)
--   RECETA.estado      emitida, anulada                     (anular -> anulada)
-- Each block only alters when the widened constraint is missing, so a re-run by a non-owner
-- login is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'diagnostico'::regclass AND conname = 'diagnostico_tipo_check'
       AND pg_get_constraintdef(oid) LIKE '%descartado%'
  ) THEN
    ALTER TABLE diagnostico DROP CONSTRAINT IF EXISTS diagnostico_tipo_check;
    ALTER TABLE diagnostico ADD CONSTRAINT diagnostico_tipo_check
      CHECK (tipo IN ('presuntivo', 'definitivo', 'descartado'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'tratamiento'::regclass AND conname = 'tratamiento_estado_check'
       AND pg_get_constraintdef(oid) LIKE '%suspendido%'
  ) THEN
    ALTER TABLE tratamiento DROP CONSTRAINT IF EXISTS tratamiento_estado_check;
    ALTER TABLE tratamiento ADD CONSTRAINT tratamiento_estado_check
      CHECK (estado IN ('activo', 'finalizado', 'suspendido'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'receta'::regclass AND conname = 'receta_estado_check'
       AND pg_get_constraintdef(oid) LIKE '%anulada%'
  ) THEN
    ALTER TABLE receta DROP CONSTRAINT IF EXISTS receta_estado_check;
    ALTER TABLE receta ADD CONSTRAINT receta_estado_check
      CHECK (estado IN ('emitida', 'anulada'));
  END IF;
END $$;
