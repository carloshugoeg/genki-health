import { it } from 'vitest';
import { asInstitutionId } from '@genki/shared';
import { MemoryEconomicStore } from '../../../src/adapters/memory/full/charges.js';
import { economicContract } from '../charges.contract.js';
it('lane A contract: money, stock, idempotency, snapshots, rollback and authorization', async () => {
  const store = new MemoryEconomicStore(1, {
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
  });
  await economicContract(
    store,
    {
      id_institucion: asInstitutionId(1),
      id_usuario: 1,
      id_profesional: null,
      roles: ['rrhh'],
      permissions: ['cargo.autorizar'],
      now: '2026-11-09T01:00:00Z',
      idempotency_key: 'memory-test',
    },
    async () => store,
  );
});
