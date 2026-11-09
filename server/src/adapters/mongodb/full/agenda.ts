import type { MongoClient, Db, ClientSession } from 'mongodb';
import type { CITA } from '@genki/shared/full/agenda';
import type { AgendaStore, AgendaTransaction } from '../../../ports/full/agenda.js';
import { AgendaApplication, type AgendaOptions } from '../../../application/full/agenda.js';

type CitaDocument = Omit<CITA, 'fecha_hora' | 'fecha_creacion'> & {
  _id: string;
  id_institucion: number;
  fecha_hora: Date;
  fecha_creacion: Date;
};
export class MongodbAgendaStore implements AgendaStore {
  constructor(
    private readonly client: MongoClient,
    private readonly db: Db,
  ) {}
  private async read(institution: number, session?: ClientSession): Promise<CITA[]> {
    const documents = await this.db
      .collection<CitaDocument>('agenda_cita')
      .find(
        { id_institucion: institution },
        { ...(session ? { session } : {}), projection: { _id: 0, id_institucion: 0 } },
      )
      .toArray();
    return documents.map((row) => ({
      ...row,
      fecha_hora: row.fecha_hora.toISOString(),
      fecha_creacion: row.fecha_creacion.toISOString(),
    }));
  }
  list(institution: number) {
    return this.read(institution);
  }
  async transaction<T>(
    institution: number,
    keys: readonly string[],
    work: (tx: AgendaTransaction) => Promise<T>,
  ): Promise<T> {
    // Guard creation is idempotent and outside the transaction; updates serialize writers.
    const guards = this.db.collection<{ _id: string; revision: number }>('agenda_lock');
    const sorted = [...new Set(keys)].sort();
    for (const key of sorted) {
      try {
        await guards.updateOne({ _id: key }, { $setOnInsert: { revision: 0 } }, { upsert: true });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
    const session = this.client.startSession();
    try {
      return (await session.withTransaction(
        async () => {
          for (const key of sorted)
            await guards.updateOne({ _id: key }, { $inc: { revision: 1 } }, { session });
          return work({
            list: () => this.read(institution, session),
            nextId: async () => {
              const counter = await this.db
                .collection<{ _id: string; value: number }>('agenda_counter')
                .findOneAndUpdate(
                  { _id: 'cita' },
                  { $inc: { value: 1 } },
                  { upsert: true, returnDocument: 'after', session },
                );
              return counter!.value;
            },
            put: async (c) => {
              await this.db.collection<CitaDocument>('agenda_cita').replaceOne(
                { id_institucion: institution, id_cita: c.id_cita },
                {
                  ...c,
                  _id: `${institution}:${c.id_cita}`,
                  id_institucion: institution,
                  fecha_hora: new Date(c.fecha_hora),
                  fecha_creacion: new Date(c.fecha_creacion),
                },
                { upsert: true, session },
              );
            },
          });
        },
        { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
      )) as T;
    } finally {
      await session.endSession();
    }
  }
}
export class MongodbAgendaRepository extends AgendaApplication {
  constructor(client: MongoClient, db: Db, options: AgendaOptions = {}) {
    super(new MongodbAgendaStore(client, db), options);
  }
}
