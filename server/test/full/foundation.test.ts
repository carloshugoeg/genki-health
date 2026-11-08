import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ClinicalErrorCode, ConsultaDto, PacienteId } from '@genki/shared';
import { createTestMemoryAdapterSet } from '../../src/config/memory-test-factory.js';
import { activeMemoryMaps, MemoryUnitOfWork } from '../../src/adapters/memory/unit-of-work.js';
import {
  cloneMemoryMaps,
  createEmptyMemoryMaps,
  type MemoryMaps,
} from '../../src/adapters/memory/state.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);

const CORE_CONSULTA_KEYS = [
  'id_consulta',
  'id_expediente',
  'id_profesional',
  'id_cita',
  'fecha_hora_inicio',
  'fecha_hora_fin',
  'tipo',
  'motivo_consulta',
  'enfermedad_actual',
  'exploracion_fisica',
  'plan',
  'estado',
] as const;

const FULL_MODULE_SLUGS = [
  'account',
  'users',
  'patient',
  'record',
  'attachments',
  'agenda',
  'consultation',
  'admission',
  'procedure',
  'discharge',
  'referral',
  'growth',
  'vaccines',
  'milestones',
  'lab-intake',
  'lab-results',
  'dental-chart',
  'dental-plan',
  'dental-session',
  'personnel',
  'honoraria',
  'inventory',
  'charges',
  'invoicing',
  'payments',
  'history',
] as const;

function samplePaciente(doc: string) {
  return {
    tipo_documento: 'DPI',
    numero_documento: doc,
    primer_nombre: 'Ana',
    primer_apellido: 'Prueba',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F' as const,
  };
}

function extensionCount(maps: MemoryMaps): number {
  const extensions = (maps as MemoryMaps & { extensions?: Map<string, unknown> }).extensions;
  if (!(extensions instanceof Map)) {
    return -1;
  }
  let total = 0;
  for (const bucket of extensions.values()) {
    if (bucket instanceof Map) {
      for (const table of bucket.values()) {
        if (table instanceof Map) {
          total += table.size;
        }
      }
    }
  }
  return total;
}

async function importRepoModule(relFromServer: string): Promise<Record<string, unknown>> {
  const absolute = join(repoRoot, 'server', relFromServer);
  return import(pathToFileURL(absolute).href) as Promise<Record<string, unknown>>;
}

async function importSharedFull(slug: string): Promise<Record<string, unknown>> {
  const absolute = join(repoRoot, 'shared', 'dist', 'full', `${slug}.js`);
  return import(pathToFileURL(absolute).href) as Promise<Record<string, unknown>>;
}

describe('FS-FOUNDATION', () => {
  it('fs_foundation_required_behavior', async () => {
    const empty = createEmptyMemoryMaps() as MemoryMaps & { extensions?: unknown };
    expect(empty).toHaveProperty('extensions');
    expect(empty.extensions).toBeInstanceOf(Map);

    const sharedPkg = JSON.parse(readFileSync(join(repoRoot, 'shared/package.json'), 'utf8')) as {
      exports?: Record<string, unknown>;
    };
    expect(sharedPkg.exports).toBeDefined();
    expect(Object.keys(sharedPkg.exports ?? {}).some((k) => k.startsWith('./full'))).toBe(true);

    const consultation = await importSharedFull('consultation');
    expect(typeof consultation.isFullConsultaDto).toBe('function');
    const sample = {
      id_consulta: 1,
      id_expediente: 1,
      id_profesional: 1,
      id_cita: null,
      fecha_hora_inicio: '2026-01-01T12:00:00.000Z',
      fecha_hora_fin: null,
      tipo: 'emergencia',
      motivo_consulta: 'dolor',
      enfermedad_actual: null,
      exploracion_fisica: null,
      plan: null,
      estado: 'abierta',
    };
    expect((consultation.isFullConsultaDto as (v: unknown) => boolean)(sample)).toBe(true);

    const coreKeys = Object.keys({
      id_consulta: 0,
      id_expediente: 0,
      id_profesional: 0,
      id_cita: null,
      fecha_hora_inicio: '',
      fecha_hora_fin: null,
      tipo: '',
      motivo_consulta: '',
      enfermedad_actual: null,
      exploracion_fisica: null,
      plan: null,
      estado: '',
    } satisfies ConsultaDto).sort();
    expect(coreKeys).toEqual([...CORE_CONSULTA_KEYS].sort());

    const retained: ClinicalErrorCode[] = [
      'invalid_bundle',
      'duplicate_document',
      'guardian_required',
      'expediente_archived',
      'already_archived',
      'store_unavailable',
    ];
    for (const code of retained) {
      expect(code.length).toBeGreaterThan(0);
    }

    const context = await importRepoModule('src/ports/full/context.js');
    expect(context.FULL_MODULE_SLUGS).toEqual([...FULL_MODULE_SLUGS]);

    const fullState = await importRepoModule('src/adapters/memory/full-state.js');
    expect(typeof fullState.registerExtensionNamespace).toBe('function');
    expect(typeof fullState.getExtensionNamespace).toBe('function');
    expect(typeof fullState.putExtensionRow).toBe('function');
    expect(typeof fullState.resetExtensionRegistryForTests).toBe('function');

    (fullState.resetExtensionRegistryForTests as () => void)();
    (fullState.registerExtensionNamespace as (slug: string) => void)('charges');
    const seeded = createEmptyMemoryMaps();
    const charges = (
      fullState.getExtensionNamespace as (
        maps: MemoryMaps,
        slug: string,
      ) => Map<string, Map<string | number, unknown>>
    )(seeded, 'charges');
    (
      fullState.putExtensionRow as (
        ns: Map<string, Map<string | number, unknown>>,
        table: string,
        id: string | number,
        row: unknown,
      ) => void
    )(charges, 'cargos', 7, { id_cargo: 7 });
    const cloned = cloneMemoryMaps(seeded);
    const clonedCharges = (
      fullState.getExtensionNamespace as (
        maps: MemoryMaps,
        slug: string,
      ) => Map<string, Map<string | number, unknown>>
    )(cloned, 'charges');
    expect(clonedCharges.get('cargos')?.get(7)).toEqual({ id_cargo: 7 });
    expect(() =>
      (fullState.registerExtensionNamespace as (slug: string) => void)('charges'),
    ).toThrow(/duplicate/i);

    // Package export map must resolve the consultation module for consumers.
    expect(() => require.resolve('@genki/shared/full/consultation')).not.toThrow();
  });

  it('fs_foundation_failure_preserves_invariants', async () => {
    const fullState = await importRepoModule('src/adapters/memory/full-state.js');
    (fullState.resetExtensionRegistryForTests as () => void)();
    (fullState.registerExtensionNamespace as (slug: string) => void)('charges');

    const set = createTestMemoryAdapterSet('hospital_general', 1);
    const before = cloneMemoryMaps(set.memoryState.getPublished());
    expect(extensionCount(before)).toBe(0);

    let createdId: PacienteId | undefined;
    await expect(
      set.unitOfWork.runInTransaction(async () => {
        const { paciente } = await set.pacientes.createWithExpediente(
          samplePaciente('fs-foundation-rollback-1'),
        );
        createdId = paciente.id_paciente;
        const working = activeMemoryMaps(set.memoryState);
        const charges = (
          fullState.getExtensionNamespace as (
            maps: MemoryMaps,
            slug: string,
          ) => Map<string, Map<string | number, unknown>>
        )(working, 'charges');
        (
          fullState.putExtensionRow as (
            ns: Map<string, Map<string | number, unknown>>,
            table: string,
            id: string | number,
            row: unknown,
          ) => void
        )(charges, 'cargos', 99, {
          id_cargo: 99,
          id_paciente: paciente.id_paciente,
        });
        expect(extensionCount(working)).toBe(1);
        throw new Error('foundation outer boom');
      }),
    ).rejects.toThrow(/foundation outer boom/);

    expect(createdId).toBeDefined();
    expect(await set.pacientes.findById(createdId!)).toBeNull();
    expect(await set.pacientes.findByDocumento('DPI', 'fs-foundation-rollback-1')).toBeNull();
    expect(extensionCount(set.memoryState.getPublished())).toBe(0);

    await set.unitOfWork.runInTransaction(async () => {
      const { paciente } = await set.pacientes.createWithExpediente(
        samplePaciente('fs-foundation-commit-1'),
      );
      const working = activeMemoryMaps(set.memoryState);
      const charges = (
        fullState.getExtensionNamespace as (
          maps: MemoryMaps,
          slug: string,
        ) => Map<string, Map<string | number, unknown>>
      )(working, 'charges');
      (
        fullState.putExtensionRow as (
          ns: Map<string, Map<string | number, unknown>>,
          table: string,
          id: string | number,
          row: unknown,
        ) => void
      )(charges, 'cargos', 100, {
        id_cargo: 100,
        id_paciente: paciente.id_paciente,
      });
    });
    expect(await set.pacientes.findByDocumento('DPI', 'fs-foundation-commit-1')).not.toBeNull();
    expect(extensionCount(set.memoryState.getPublished())).toBe(1);
    expect(set.unitOfWork).toBeInstanceOf(MemoryUnitOfWork);
  });
});
