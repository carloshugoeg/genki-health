-- Demo beds/services for hospitalización specialty (idempotent upserts).

INSERT INTO servicio (id_servicio, nombre, piso, activo)
VALUES (1, 'Medicina Interna', '2', TRUE)
ON CONFLICT (id_servicio) DO NOTHING;

INSERT INTO servicio_facturable (
  codigo_servicio, id_institucion, nombre, tipo, precio_unitario, unidad, afecto_iva, vigente
) VALUES (
  'CAMA-DIA', 1, 'Día cama hospitalaria', 'hospitalizacion', 250.00, 'dia', TRUE, TRUE
) ON CONFLICT (codigo_servicio) DO NOTHING;

INSERT INTO cama (id_servicio, codigo, tipo_cama, codigo_servicio, estado)
VALUES
  (1, 'A-01', 'estandar', 'CAMA-DIA', 'libre'),
  (1, 'A-02', 'estandar', 'CAMA-DIA', 'libre'),
  (1, 'B-01', 'aislamiento', 'CAMA-DIA', 'libre')
ON CONFLICT (id_servicio, codigo) DO NOTHING;
