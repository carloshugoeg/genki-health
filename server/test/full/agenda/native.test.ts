import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { randomInt } from 'node:crypto';
import { asInstitutionId } from '@genki/shared';
import { agendaContract, booking, defaultContext } from '../agenda.contract.js';
import { nativeAgenda, type Engine, seedAgenda } from './fixtures.js';

const engines: Engine[] = ['postgres', 'mysql', 'mongodb', 'firebase'];
if (process.env.AGENDA_TEST_ENGINE && !engines.includes(process.env.AGENDA_TEST_ENGINE as Engine))
  throw new Error('AGENDA_TEST_ENGINE inválido');
describe.skipIf(process.env.TEST_AGENDA_ENGINES !== '1')(
  'Native agenda persistence (no memory)',
  () => {
    for (const engine of engines.filter(
      (e) => !process.env.AGENDA_TEST_ENGINE || e === process.env.AGENDA_TEST_ENGINE,
    ))
      describe(engine, () => {
        let native: Awaited<ReturnType<typeof nativeAgenda>>;
        beforeAll(async () => {
          native = await nativeAgenda(engine);
          await native.migrate();
          await native.migrate();
        }, 60000);
        afterAll(async () => {
          await native?.close();
        });
        agendaContract(engine, async () => native.repository());
        it('OP21 → new repository OP25 → physical row/document; injected OP22 post-write failure rolls back', async () => {
          const context = {
            ...defaultContext,
            id_institucion: asInstitutionId(randomInt(10000, 1000000000)),
          };
          const cita = await native
            .repository()
            .op21({ params: {}, query: {}, body: booking }, context);
          const query = { params: {}, query: { fecha: '2026-11-09' }, body: {} };
          expect((await native.repository().op25(query, context))[0]?.id_cita).toBe(cita.id_cita);
          const raw = await native.raw(context.id_institucion, cita.id_cita);
          expect(Number(raw?.id_cita)).toBe(cita.id_cita);
          const failing = native.repository({
            afterWrite: () => {
              throw new Error('injected mid-write failure');
            },
          });
          await expect(
            failing.op22(
              {
                params: { id: cita.id_cita },
                query: {},
                body: { fecha_hora: '2026-11-10T14:00:00Z', duracion_minutos: 30 },
              },
              context,
            ),
          ).rejects.toThrow('injected');
          expect((await native.repository().op25(query, context))[0]?.fecha_hora).toBe(
            cita.fecha_hora,
          );
          expect(
            await native.repository().op25({ ...query, query: { fecha: '2026-11-10' } }, context),
          ).toEqual([]);
          await expect(
            native.repository().op21({ params: {}, query: {}, body: booking }, context),
          ).rejects.toMatchObject({ code: 'conflict' });
        });
        it('fixture seed is repeatable without changing an existing appointment', async () => {
          await seedAgenda(engine);
          await seedAgenda(engine);
          const institution = { postgres: 1, mysql: 2, mongodb: 3, firebase: 4 }[engine];
          expect(Number((await native.raw(institution, 900001))?.id_cita)).toBe(900001);
        }, 60000);
      });
  },
);
