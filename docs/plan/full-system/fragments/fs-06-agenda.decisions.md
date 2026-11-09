# FS-06 — Decisiones de implementación de agenda

Base: `cursor/genki-firestore-real-mode@7786ec4c52cb355c530a89f960010961a354fdb9`.
Alcance autorizado: brief lane B, OP20–25 en los cuatro motores. El brief prevalece
sobre el proceso de trackers globales: solo se modifican rutas propias del módulo.

- Una aplicación de agenda implementa el puerto OP20–25; los adaptadores aportan
  lectura y transacción nativas mediante `AgendaStore`. No hay fallback de motores.
- SQL conserva columnas de CITA, INTEGER/SMALLINT/VARCHAR(200), fechas UTC,
  estado fuente y generación de IDs. PostgreSQL usa identity/sequence; MySQL un
  allocator AUTO_INCREMENT del módulo. Mongo y Firestore usan contadores nativos.
  Los IDs de paciente/profesional/actor son referencias numéricas; esta lane no crea
  sus entidades ni altera identity. El finalizador de relaciones conserva la propiedad
  de FKs y grants globales.
- Exclusión por intervalos semiabiertos: igualdad de extremos permite adyacencia;
  cancelada/no_asistio no bloquean. Locks ordenados para todos los días Guatemala
  atravesados por el intervalo, incluyendo ambos destinos al reprogramar.
  PG advisory xact locks; MySQL filas `agenda_lock` FOR UPDATE; Mongo guardas
  con revisión en replica-set transactions; Firestore documentos de guarda y
  transacciones con reintentos. Un movimiento concurrente detectado tras prelectura
  devuelve conflict. No hay mutex de aplicación en adaptadores nativos.
- Las consultas de agenda leen la colección/tabla de la institución. Es una
  implementación MVP; el volumen de una institución grande requiere consultas
  por rango y paginación antes de ampliar su uso. Firestore puede contender entre
  consultas de la misma institución; sus reintentos mantienen consistencia.
- OP22 deja estado programada, incluso desde confirmada. OP24 confirma y es
  idempotente; atendida/cancelada/no_asistio no admiten llegada ni reprogramación.
- El horario 08–17, lunes–sábado, paso 30 minutos es un supuesto académico
  configurable vía `AgendaOptions.hours`, no una afirmación del documento fuente.
  No se impone ese horario a la creación de citas: disponibilidad y persistencia
  mantienen contratos separados.
- El motivo clínico de CITA se omite para roles no clínicos, incluidos administrador,
  auditor y recepción. Roles clínicos: medico, odontologo, enfermeria, laboratorista.
  OP23 valida el motivo de cancelación, conserva el registro y su motivo clínico;
  no inventa un atributo motivo_cancelacion ni sobrescribe información clínica.
- Plugin `agendaPlugin` y componente `Agenda` son independientes. El host debe
  verificar la identidad, autorizar la operación y seleccionar el repositorio con
  contexto confiable en `resolve`; el cliente de la UI usa la sesión existente.
  No se han montado en App/router/composition, conforme al brief. No hay cambios de auth.
- Fixtures exclusivamente sintéticas. Se requieren conexiones explícitas a bases
  locales y Firestore emulator. Seeds no borran ni sobrescriben citas existentes.
  No se ejecutan contra producción/staging, ni se despliega o fusiona la rama.
