-- OP-43 explicit dose-interval catalog (VACUNA_INTERVALO) for the vaccines seeded in
-- 0004-pediatrics-seed.sql. Re-runnable: keeps existing rows untouched.
-- Ages follow the national infant schedule: BCG at birth; Pentavalente at 2, 4 and 6 months
-- (dosis_totales = 3, edad_recomendada_meses = 2 in VACUNA).

INSERT INTO vacuna (
  id_institucion, id_vacuna, nombre, enfermedad_previene, dosis_totales,
  via_administracion, edad_recomendada_meses
) VALUES
  (2, 1, 'BCG', 'Tuberculosis', 1, 'intradermica', 0),
  (2, 2, 'Pentavalente', 'DPT-HepB-Hib', 3, 'intramuscular', 2)
ON DUPLICATE KEY UPDATE id_vacuna = id_vacuna;

INSERT INTO vacuna_intervalo (id_institucion, id_vacuna, numero_dosis, edad_meses) VALUES
  (2, 1, 1, 0),
  (2, 2, 1, 2),
  (2, 2, 2, 4),
  (2, 2, 3, 6)
ON DUPLICATE KEY UPDATE edad_meses = edad_meses;
