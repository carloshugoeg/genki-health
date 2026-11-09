import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { CITA } from '@genki/shared/full/agenda';
import type { AgendaStore, AgendaTransaction } from '../../../ports/full/agenda.js';
import { AgendaApplication, type AgendaOptions } from '../../../application/full/agenda.js';

const columns =
  'id_cita,id_paciente,id_profesional,id_especialidad,fecha_hora,duracion_minutos,motivo,estado,id_usuario_registra,fecha_creacion';
function dto(row: QueryResultRow): CITA {
  return {
    id_cita: Number(row.id_cita),
    id_paciente: Number(row.id_paciente),
    id_profesional: Number(row.id_profesional),
    id_especialidad: row.id_especialidad == null ? null : Number(row.id_especialidad),
    fecha_hora: new Date(row.fecha_hora).toISOString(),
    duracion_minutos: Number(row.duracion_minutos),
    motivo: row.motivo,
    estado: row.estado,
    id_usuario_registra: Number(row.id_usuario_registra),
    fecha_creacion: new Date(row.fecha_creacion).toISOString(),
  };
}
export class PostgresAgendaStore implements AgendaStore {
  constructor(private readonly pool: Pool) {}
  private async read(client: Pool | PoolClient, institution: number) {
    return (
      await client.query(`SELECT ${columns} FROM agenda_cita WHERE id_institucion=$1`, [
        institution,
      ])
    ).rows.map(dto);
  }
  list(institution: number) {
    return this.read(this.pool, institution);
  }
  async transaction<T>(
    institution: number,
    keys: readonly string[],
    work: (tx: AgendaTransaction) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      for (const key of [...new Set(keys)].sort())
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `agenda/${key}`,
        ]);
      const result = await work({
        list: () => this.read(client, institution),
        nextId: async () =>
          Number(
            (
              await client.query(
                "SELECT nextval(pg_get_serial_sequence('agenda_cita','id_cita')) AS id",
              )
            ).rows[0].id,
          ),
        put: async (c) => {
          await client.query(
            `INSERT INTO agenda_cita (id_institucion,${columns}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id_institucion,id_cita) DO UPDATE SET fecha_hora=EXCLUDED.fecha_hora,duracion_minutos=EXCLUDED.duracion_minutos,estado=EXCLUDED.estado`,
            [
              institution,
              c.id_cita,
              c.id_paciente,
              c.id_profesional,
              c.id_especialidad ?? null,
              c.fecha_hora,
              c.duracion_minutos,
              c.motivo ?? null,
              c.estado,
              c.id_usuario_registra,
              c.fecha_creacion,
            ],
          );
        },
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
export class PostgresAgendaRepository extends AgendaApplication {
  constructor(pool: Pool, options: AgendaOptions = {}) {
    super(new PostgresAgendaStore(pool), options);
  }
}
