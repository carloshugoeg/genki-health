import type { LabHistory, Page, RESULTADO, ResultadoFlags } from '@genki/shared/full/lab-results';
import type { MUESTRA, ORDEN_EXAMEN } from '@genki/shared/full/schema';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  LabResultsRepositoryPort,
  Op50Request,
  Op50Response,
  Op51Request,
  Op51Response,
  Op52Request,
  Op52Response,
  Op53Request,
  Op53Response,
  Op54Request,
  Op54Response,
} from '../../../ports/full/lab-results.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export function createMemoryLabResultsRepository(deps: {
  state: MemoryInstitutionState;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): LabResultsRepositoryPort {
  return {
    async op50(input: Op50Request, context: OperationContext): Promise<Op50Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const intake = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-intake');
        const results = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-results');
        const orden = intake.get('orden')?.get(input.params.id) as ORDEN_EXAMEN | undefined;
        if (!orden) throw new ClinicalError('not_found', NOT_FOUND);
        const muestra = intake.get('muestra')?.get(input.body.id_muestra) as MUESTRA | undefined;
        if (!muestra || muestra.id_orden !== orden.id_orden) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        const id_resultado = await deps.ids.nextInt('resultado');
        const row: RESULTADO = {
          id_resultado,
          id_orden: orden.id_orden,
          codigo_examen: input.body.codigo_examen,
          id_muestra: input.body.id_muestra,
          fecha_hora_resultado: context.now || deps.clock.nowIso(),
          datos: input.body.datos as RESULTADO['datos'],
          estado: 'registrado',
          ...(input.body.observaciones !== undefined
            ? { observaciones: input.body.observaciones }
            : {}),
        };
        if (!results.has('resultado')) results.set('resultado', new Map());
        results.get('resultado')!.set(id_resultado, row);
        return structuredClone(row);
      });
    },

    async op51(input: Op51Request, context: OperationContext): Promise<Op51Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const results = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-results');
        const row = results.get('resultado')?.get(input.params.id) as RESULTADO | undefined;
        if (!row) throw new ClinicalError('not_found', NOT_FOUND);
        if (row.estado !== 'registrado') throw new ClinicalError('conflict', CONFLICT);
        const updated: RESULTADO = {
          ...row,
          estado: 'validado',
          validado_por: context.id_profesional,
          fecha_validacion: context.now || deps.clock.nowIso(),
        };
        results.get('resultado')!.set(row.id_resultado, updated);
        return structuredClone(updated);
      });
    },

    async op52(input: Op52Request, _context: OperationContext): Promise<Op52Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const results = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-results');
        const row = results.get('resultado')?.get(input.params.id) as RESULTADO | undefined;
        if (!row) throw new ClinicalError('not_found', NOT_FOUND);
        const flags: ResultadoFlags = { id_resultado: row.id_resultado, analitos: [] };
        const datos = row.datos;
        if (datos && typeof datos === 'object' && !Array.isArray(datos) && 'analitos' in datos) {
          const list = (datos as { analitos?: unknown }).analitos;
          if (Array.isArray(list)) {
            for (const item of list) {
              if (!item || typeof item !== 'object') continue;
              const a = item as Record<string, unknown>;
              const valor = Number(a.valor);
              const min = Number(a.min ?? 0);
              const max = Number(a.max ?? 0);
              flags.analitos.push({
                nombre: String(a.nombre ?? ''),
                valor,
                unidad: String(a.unidad ?? ''),
                min,
                max,
                fuera_rango: valor < min || valor > max,
                referencia_version: String(a.referencia_version ?? 'none'),
              });
            }
          }
        }
        return flags;
      });
    },

    async op53(input: Op53Request, _context: OperationContext): Promise<Op53Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const intake = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-intake');
        const orden = intake.get('orden')?.get(input.params.id) as ORDEN_EXAMEN | undefined;
        if (!orden) throw new ClinicalError('not_found', NOT_FOUND);
        const updated = { ...orden, estado: 'entregada' };
        intake.get('orden')!.set(orden.id_orden, updated);
        return structuredClone(updated);
      });
    },

    async op54(input: Op54Request, _context: OperationContext): Promise<Op54Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const intake = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-intake');
        const results = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-results');
        const page = input.query.page ?? 1;
        const page_size = input.query.page_size ?? 20;
        const ordenes = [...(intake.get('orden')?.values() ?? [])] as Array<
          ORDEN_EXAMEN & { examenes?: string[] }
        >;
        const matched = ordenes.filter((o) => o.id_paciente === input.params.id);
        const items: LabHistory[] = matched.map((orden) => {
          const muestras = [...(intake.get('muestra')?.values() ?? [])].filter(
            (m) => (m as MUESTRA).id_orden === orden.id_orden,
          ) as MUESTRA[];
          const resultados = [...(results.get('resultado')?.values() ?? [])].filter(
            (r) => (r as RESULTADO).id_orden === orden.id_orden,
          ) as RESULTADO[];
          const { examenes: _e, ...clean } = orden;
          return { orden: clean, muestras, resultados };
        });
        const start = (page - 1) * page_size;
        const out: Page<LabHistory> = {
          items: items.slice(start, start + page_size).map((i) => structuredClone(i)),
          page,
          page_size,
          total: items.length,
        };
        return out;
      });
    },
  };
}
