-- Catalog seeds for vaccines and milestones (idempotent).

INSERT INTO vacuna (
  id_institucion, id_vacuna, nombre, enfermedad_previene, dosis_totales,
  via_administracion, edad_recomendada_meses
) VALUES
  (2, 1, 'BCG', 'Tuberculosis', 1, 'intradermica', 0),
  (2, 2, 'Pentavalente', 'DPT-HepB-Hib', 3, 'intramuscular', 2)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO hito_desarrollo (id_institucion, id_hito, nombre, area, edad_esperada_meses)
VALUES
  (2, 1, 'Sostiene la cabeza', 'motor', 3),
  (2, 2, 'Sonrisa social', 'social', 2)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
