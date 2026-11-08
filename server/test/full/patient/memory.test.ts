import { createHash } from 'node:crypto';
import { asInstitutionId } from '@genki/shared';
import type { CONTACTO_EMERGENCIA } from '@genki/shared/full/patient';
import {
  getExtensionNamespace,
  registerExtensionNamespace,
  resetExtensionRegistryForTests,
} from '../../../src/adapters/memory/full-state.js';
import { MemoryPatientRepository } from '../../../src/adapters/memory/full/patient.js';
import { createTestMemoryAdapterSet } from '../../../src/config/memory-test-factory.js';
import type { FullContext, FullModulePorts, OperationContext } from '../../../src/ports/full/context.js';
import type { PatientRepositoryPort } from '../../../src/ports/full/patient.js';
import { moduleContract, type FullHarness } from '../patient.contract.js';

const PATIENT_SLUG = 'patient';
const CONTACTOS = 'contactos';

function hashRows(rows: unknown[]): string {
  const normalized = [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function stubModules(patient: PatientRepositoryPort): FullModulePorts {
  const missing = new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error('module not in FS-03-C01 scope');
        };
      },
    },
  );
  return new Proxy({ patient } as FullModulePorts, {
    get(target, prop) {
      if (prop === 'patient') {
        return target.patient;
      }
      return missing;
    },
  });
}

function actorFor(institutionId: number): OperationContext {
  return {
    id_institucion: asInstitutionId(institutionId),
    id_usuario: 1,
    id_profesional: null,
    roles: ['recepcion'],
    permissions: ['paciente.actualizar', 'paciente.contacto'],
    now: '2026-11-08T12:00:00.000Z',
  };
}

async function makeHarness(institutionId = 1): Promise<FullHarness> {
  resetExtensionRegistryForTests();
  registerExtensionNamespace(PATIENT_SLUG);

  const set = createTestMemoryAdapterSet('hospital_general', institutionId);
  const patientRepo = new MemoryPatientRepository({
    state: set.memoryState,
    ids: set.ids,
    unitOfWork: set.unitOfWork,
    id_institucion: asInstitutionId(institutionId),
    clock: set.clock,
  });

  const context: FullContext = {
    base: {
      pacientes: set.pacientes,
      consultas: set.consultas,
      catalogos: set.catalogos,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
      ids: set.ids,
    },
    modules: stubModules(patientRepo),
    unitOfWork: set.unitOfWork,
    clock: set.clock,
    ids: set.ids,
  };

  return {
    context,
    actor: actorFor(institutionId),
    async reset() {
      const maps = set.memoryState.getPublished();
      maps.pacientes.clear();
      maps.expedientes.clear();
      maps.responsables.clear();
      maps.consultas.clear();
      maps.diagnosticos.clear();
      maps.tratamientos.clear();
      maps.recetas.clear();
      maps.detalles.clear();
      getExtensionNamespace(maps, PATIENT_SLUG).clear();
      patientRepo.resetFaults();
    },
    async counts() {
      const maps = set.memoryState.getPublished();
      const contactos = getExtensionNamespace(maps, PATIENT_SLUG).get(CONTACTOS);
      return {
        pacientes: maps.pacientes.size,
        expedientes: maps.expedientes.size,
        contactos: contactos?.size ?? 0,
      };
    },
    async nativeSnapshot() {
      const maps = set.memoryState.getPublished();
      const pacientes = [...maps.pacientes.values()].map((row) => structuredClone(row));
      const contactos = [
        ...(getExtensionNamespace(maps, PATIENT_SLUG).get(CONTACTOS)?.values() ?? []),
      ].map((row) => structuredClone(row as CONTACTO_EMERGENCIA));
      return {
        pacientes: hashRows(pacientes),
        contactos: hashRows(contactos),
      };
    },
    failAfterWrite(n: number) {
      patientRepo.failAfterWrite(n);
    },
    async otherInstitution() {
      return makeHarness(99);
    },
    async close() {},
  };
}

moduleContract('patient', () => makeHarness(1), [9, 10]);
