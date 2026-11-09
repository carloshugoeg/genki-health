import { randomUUID } from 'node:crypto';
import { it } from 'vitest';
import { asInstitutionId } from '@genki/shared';
import { connect, engines, type Engine } from './harness.js';
import { economicContract } from '../charges.contract.js';
import type { EconomicReferences } from '../../../src/ports/full/charges.js';
const selected = process.env.LANE_A_ENGINE as Engine | undefined;
for (const engine of engines)
  it.skipIf(process.env.LANE_A_ENGINES !== '1' || (selected && selected !== engine))(
    `${engine}: native commit and reopen, atomic money and stock`,
    async () => {
      // Clinical fixtures are explicit test references; economic persistence is exclusively native.
      const refs: EconomicReferences = {
        patient: async (id) => (id === 1 ? { id_paciente: 1, id_expediente: 1 } : null),
        act: async (kind, id) =>
          id === 1
            ? {
                kind,
                id,
                id_paciente: 1,
                codigo_servicio: 'CONSULTA',
                fecha_hora: '2026-11-08T12:00:00Z',
              }
            : null,
      };
      const connection = await connect(engine, refs);
      let reopened: Awaited<ReturnType<typeof connect>> | undefined;
      try {
        await connection.migrate();
        await connection.migrate();
        const ctx = {
          id_institucion: asInstitutionId(connection.store.institution),
          id_usuario: 1,
          id_profesional: null,
          roles: ['rrhh'],
          permissions: ['cargo.autorizar'],
          now: '2026-11-09T01:00:00Z',
          idempotency_key: randomUUID(),
        };
        await economicContract(connection.store, ctx, async () => {
          reopened = await connect(engine, refs);
          return reopened.store;
        });
      } finally {
        if (reopened) await reopened.close();
        await connection.close();
      }
    },
    60000,
  );
