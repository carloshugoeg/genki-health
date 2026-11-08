import type {
  ConsultaCompleta,
  ConsultaDto,
  ConsultaId,
  DetalleRecetaDto,
  DiagnosticoDto,
  DiagnosticoId,
  ExpedienteId,
  RecetaDto,
  RecetaId,
  TratamientoDto,
  TratamientoId,
} from '@genki/shared';
import { asConsultaId } from '@genki/shared';
import { ClinicalError } from '../../domain/clinical-error.js';
import type {
  CloseConsultaBundle,
  ConsultaRepositoryPort,
  IdPort,
  PersistenceCheckpoint,
  UnitOfWorkPort,
} from '../../ports/index.js';
import type { MemoryInstitutionState, MemoryMaps } from './state.js';
import { activeMemoryMaps } from './unit-of-work.js';

const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';
const EXPEDIENTE_ARCHIVED = 'El expediente está archivado';
const NOT_FOUND = 'Recurso no encontrado';

function cloneDto<T>(value: T): T {
  return structuredClone(value);
}

function asDiagnosticoId(value: number): DiagnosticoId {
  return value as DiagnosticoId;
}

function asTratamientoId(value: number): TratamientoId {
  return value as TratamientoId;
}

function asRecetaId(value: number): RecetaId {
  return value as RecetaId;
}

function findExpediente(maps: MemoryMaps, id_expediente: ExpedienteId) {
  for (const [pacienteId, expediente] of maps.expedientes.entries()) {
    if (expediente.id_expediente === id_expediente) {
      return { pacienteId, expediente };
    }
  }
  return null;
}

function cie10Exists(maps: MemoryMaps, codigo: string): boolean {
  if (maps.catalogs.cie10.has(codigo)) {
    return true;
  }
  for (const row of maps.catalogs.cie10.values()) {
    if (
      typeof row === 'object' &&
      row !== null &&
      'codigo_cie10' in row &&
      (row as { codigo_cie10: unknown }).codigo_cie10 === codigo
    ) {
      return true;
    }
  }
  return false;
}

function professionalActive(maps: MemoryMaps, id_profesional: number): boolean {
  const row = maps.catalogs.profesionales.get(id_profesional);
  if (!row || typeof row !== 'object') {
    return false;
  }
  const activo = (row as { activo?: boolean }).activo;
  return activo !== false;
}

function medicationActive(maps: MemoryMaps, id_medicamento: number): boolean {
  const row = maps.catalogs.medicamentos.get(id_medicamento);
  if (!row || typeof row !== 'object') {
    return false;
  }
  const activo = (row as { activo?: boolean }).activo;
  return activo !== false;
}

function assembleCompleta(maps: MemoryMaps, consulta: ConsultaDto): ConsultaCompleta {
  const diagnosticos = [...maps.diagnosticos.values()]
    .filter((row): row is DiagnosticoDto => {
      return (
        typeof row === 'object' &&
        row !== null &&
        (row as DiagnosticoDto).id_consulta === consulta.id_consulta
      );
    })
    .map(cloneDto)
    .sort((a, b) => a.id_diagnostico - b.id_diagnostico);

  const dxIds = new Set(diagnosticos.map((d) => d.id_diagnostico));
  const tratamientos = [...maps.tratamientos.values()]
    .filter((row): row is TratamientoDto => {
      return (
        typeof row === 'object' && row !== null && dxIds.has((row as TratamientoDto).id_diagnostico)
      );
    })
    .map(cloneDto)
    .sort((a, b) => a.id_tratamiento - b.id_tratamiento);

  let receta: RecetaDto | null = null;
  let detalles: DetalleRecetaDto[] = [];
  for (const row of maps.recetas.values()) {
    if (
      typeof row === 'object' &&
      row !== null &&
      (row as RecetaDto).id_consulta === consulta.id_consulta
    ) {
      receta = cloneDto(row as RecetaDto);
      detalles = [...maps.detalles.values()]
        .filter((d): d is DetalleRecetaDto => {
          return (
            typeof d === 'object' &&
            d !== null &&
            (d as DetalleRecetaDto).id_receta === receta!.id_receta
          );
        })
        .map(cloneDto)
        .sort((a, b) => a.id_medicamento - b.id_medicamento);
      break;
    }
  }

  return {
    consulta: cloneDto(consulta),
    diagnosticos,
    tratamientos,
    receta,
    detalles,
  };
}

export class MemoryConsultaRepository implements ConsultaRepositoryPort {
  constructor(
    private readonly state: MemoryInstitutionState,
    private readonly ids: IdPort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly afterWrite: (point: PersistenceCheckpoint) => void = () => {},
    private readonly afterConsulta: () => void = () => {},
    private readonly afterDiagnostico: () => void = () => {},
  ) {}

  async closeConsulta(bundle: CloseConsultaBundle): Promise<ConsultaCompleta> {
    return this.unitOfWork.runInTransaction(async () => {
      const maps = activeMemoryMaps(this.state);
      const found = findExpediente(maps, bundle.consulta.id_expediente);
      if (!found) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      if (found.expediente.estado === 'archivado') {
        throw new ClinicalError('expediente_archived', EXPEDIENTE_ARCHIVED);
      }

      if (!professionalActive(maps, bundle.consulta.id_profesional)) {
        throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
      }

      for (const dx of bundle.diagnosticos) {
        if (dx.codigo_cie10 != null && dx.codigo_cie10 !== '') {
          if (!cie10Exists(maps, dx.codigo_cie10)) {
            throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
          }
        }
      }

      if (bundle.receta) {
        for (const detalle of bundle.receta.detalles) {
          if (!medicationActive(maps, detalle.id_medicamento)) {
            throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
          }
        }
      }

      const id_consulta = asConsultaId(await this.ids.nextInt('consulta'));
      const consulta: ConsultaDto = {
        id_consulta,
        ...bundle.consulta,
      };
      maps.consultas.set(id_consulta, consulta);
      this.afterWrite('afterConsulta');
      this.afterConsulta();

      const diagnosisIds: DiagnosticoId[] = [];
      for (let i = 0; i < bundle.diagnosticos.length; i += 1) {
        const dxInput = bundle.diagnosticos[i]!;
        const id_diagnostico = asDiagnosticoId(await this.ids.nextInt('diagnostico'));
        const dx: DiagnosticoDto = {
          id_diagnostico,
          id_consulta,
          codigo_cie10: dxInput.codigo_cie10,
          descripcion: dxInput.descripcion,
          tipo: dxInput.tipo,
          es_principal: dxInput.es_principal,
          fecha_registro: dxInput.fecha_registro,
        };
        maps.diagnosticos.set(id_diagnostico, dx);
        diagnosisIds.push(id_diagnostico);
        this.afterWrite('afterDiagnostico');
        if (i === 0) {
          this.afterDiagnostico();
        }
      }

      for (const txInput of bundle.tratamientos) {
        const id_diagnostico = diagnosisIds[txInput.diagnostico_index];
        if (id_diagnostico == null) {
          throw new ClinicalError('invalid_bundle', 'Índice de diagnóstico inválido');
        }
        const id_tratamiento = asTratamientoId(await this.ids.nextInt('tratamiento'));
        const tx: TratamientoDto = {
          id_tratamiento,
          id_diagnostico,
          tipo: txInput.tipo,
          descripcion: txInput.descripcion,
          indicaciones: txInput.indicaciones,
          fecha_inicio: txInput.fecha_inicio,
          fecha_fin_estimada: txInput.fecha_fin_estimada,
          estado: txInput.estado,
        };
        maps.tratamientos.set(id_tratamiento, tx);
      }

      if (bundle.receta) {
        const id_receta = asRecetaId(await this.ids.nextInt('receta'));
        const receta: RecetaDto = {
          id_receta,
          id_consulta,
          ...bundle.receta.header,
        };
        maps.recetas.set(id_receta, receta);
        for (const detalleInput of bundle.receta.detalles) {
          const detalle: DetalleRecetaDto = {
            id_receta,
            ...detalleInput,
          };
          maps.detalles.set(`${id_receta}:${detalleInput.id_medicamento}`, detalle);
        }
      }

      return assembleCompleta(maps, consulta);
    });
  }

  async findById(id: ConsultaId): Promise<ConsultaDto | null> {
    const found = activeMemoryMaps(this.state).consultas.get(id);
    if (!found || typeof found !== 'object') {
      return null;
    }
    return cloneDto(found as ConsultaDto);
  }

  async listByExpediente(id: ExpedienteId): Promise<ConsultaCompleta[]> {
    const maps = activeMemoryMaps(this.state);
    const consultas = [...maps.consultas.values()]
      .filter((row): row is ConsultaDto => {
        return typeof row === 'object' && row !== null && (row as ConsultaDto).id_expediente === id;
      })
      .sort((a, b) => {
        if (a.fecha_hora_inicio !== b.fecha_hora_inicio) {
          return a.fecha_hora_inicio < b.fecha_hora_inicio ? 1 : -1;
        }
        return b.id_consulta - a.id_consulta;
      });
    return consultas.map((consulta) => assembleCompleta(maps, consulta));
  }
}
