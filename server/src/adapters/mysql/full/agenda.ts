import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { CITA } from '@genki/shared/full/agenda';
import type { AgendaStore, AgendaTransaction } from '../../../ports/full/agenda.js';
import { AgendaApplication, type AgendaOptions } from '../../../application/full/agenda.js';

const columns =
  'id_cita,id_paciente,id_profesional,id_especialidad,fecha_hora,duracion_minutos,motivo,estado,id_usuario_registra,fecha_creacion';
function dto(row: RowDataPacket): CITA {
  const utc = (date: Date | string) =>
    date instanceof Date
      ? date.toISOString()
      : new Date(`${date.replace(' ', 'T')}Z`).toISOString();
  return {
    id_cita: Number(row.id_cita),
    id_paciente: Number(row.id_paciente),
    id_profesional: Number(row.id_profesional),
    id_especialidad: row.id_especialidad == null ? null : Number(row.id_especialidad),
    fecha_hora: utc(row.fecha_hora),
    duracion_minutos: Number(row.duracion_minutos),
    motivo: row.motivo,
    estado: row.estado,
    id_usuario_registra: Number(row.id_usuario_registra),
    fecha_creacion: utc(row.fecha_creacion),
  };
}
export class MysqlAgendaStore implements AgendaStore {
  constructor(private readonly pool: Pool) {}
  private async read(client: Pool | PoolConnection, institution: number) {
    const [rows] = await client.query<RowDataPacket[]>(
      `SELECT ${columns} FROM agenda_cita WHERE id_institucion=?`,
      [institution],
    );
    return rows.map(dto);
  }
  list(institution: number) {
    return this.read(this.pool, institution);
  }
  async transaction<T>(
    institution: number,
    keys: readonly string[],
    work: (tx: AgendaTransaction) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.getConnection();
    try {
      await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await client.beginTransaction();
      for (const key of [...new Set(keys)].sort()) {
        await client.query('INSERT IGNORE INTO agenda_lock (lock_key) VALUES (?)', [key]);
        await client.query('SELECT lock_key FROM agenda_lock WHERE lock_key=? FOR UPDATE', [key]);
      }
      const sqlDate = (value: string) =>
        new Date(value).toISOString().slice(0, 23).replace('T', ' ');
      const result = await work({
        list: () => this.read(client, institution),
        nextId: async () => {
          const [result] = await client.query<ResultSetHeader>(
            'INSERT INTO agenda_cita_id () VALUES ()',
          );
          return result.insertId;
        },
        put: async (c) => {
          await client.query(
            `INSERT INTO agenda_cita (id_institucion,${columns}) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fecha_hora=VALUES(fecha_hora),duracion_minutos=VALUES(duracion_minutos),estado=VALUES(estado)`,
            [
              institution,
              c.id_cita,
              c.id_paciente,
              c.id_profesional,
              c.id_especialidad ?? null,
              sqlDate(c.fecha_hora),
              c.duracion_minutos,
              c.motivo ?? null,
              c.estado,
              c.id_usuario_registra,
              sqlDate(c.fecha_creacion),
            ],
          );
        },
      });
      await client.commit();
      return result;
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }
}
export class MysqlAgendaRepository extends AgendaApplication {
  constructor(pool: Pool, options: AgendaOptions = {}) {
    super(new MysqlAgendaStore(pool), options);
  }
}
