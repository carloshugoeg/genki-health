import type {
  ArchiveExpedienteInput,
  CatalogosDto,
  ConsultaCompleta,
  ConsultaDto,
  ConsultaId,
  ExpedienteDto,
  ExpedienteId,
  InstitutionKind,
  PacienteDto,
  PacienteId,
  PacientePage,
  PacienteResumen,
  RegisterPacienteRequest,
} from '@genki/shared';
import type { PersistenceCheckpoint } from '../../src/ports/adapter-resource.js';
import type { ClockPort } from '../../src/ports/clock.js';
import type { CloseConsultaBundle } from '../../src/ports/consulta-repository.js';
import type { IdPort } from '../../src/ports/id.js';
import type { UnitOfWorkPort } from '../../src/ports/unit-of-work.js';

export type FailurePoint = PersistenceCheckpoint;

export interface SearchPacientesInput {
  q: string;
  estado: 'activo' | 'archivado' | 'todos';
  page: number;
  page_size: number;
}

export interface ContractPacienteRepository {
  createWithExpediente(input: RegisterPacienteRequest): Promise<PacienteResumen>;
  findById(id: PacienteId): Promise<PacienteDto | null>;
  findByDocumento(tipo_documento: string, numero_documento: string): Promise<PacienteDto | null>;
  findExpedienteByPaciente(id: PacienteId): Promise<ExpedienteDto | null>;
  findExpedienteById(id: ExpedienteId): Promise<ExpedienteDto | null>;
  list(input: SearchPacientesInput): Promise<PacientePage>;
  archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto>;
}

export interface ContractConsultaRepository {
  closeConsulta(bundle: CloseConsultaBundle): Promise<ConsultaCompleta>;
  findById(id: ConsultaId): Promise<ConsultaDto | null>;
  listByExpediente(id: ExpedienteId): Promise<ConsultaCompleta[]>;
}

export interface ContractCatalogoRepository {
  list(): Promise<CatalogosDto>;
}

export interface ContractClinicalContext {
  readonly pacientes: ContractPacienteRepository;
  readonly consultas: ContractConsultaRepository;
  readonly catalogos: ContractCatalogoRepository;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
}

export interface ClinicalHarness {
  context: ContractClinicalContext;
  reset(): Promise<void>;
  failNext(point: FailurePoint): void;
  counts(): Promise<
    Record<
      | 'pacientes'
      | 'expedientes'
      | 'responsables'
      | 'consultas'
      | 'diagnosticos'
      | 'tratamientos'
      | 'recetas'
      | 'detalles',
      number
    >
  >;
  otherInstitution(): Promise<ContractClinicalContext>;
  close(): Promise<void>;
}

export type ClinicalHarnessFactory = (options?: {
  kind?: InstitutionKind;
}) => Promise<ClinicalHarness>;

export type CountSnapshot = Awaited<ReturnType<ClinicalHarness['counts']>>;

export function assertCountsEqual(actual: CountSnapshot, expected: CountSnapshot): void {
  for (const key of Object.keys(expected) as (keyof CountSnapshot)[]) {
    if (actual[key] !== expected[key]) {
      throw new Error(`count ${key}: expected ${expected[key]}, got ${actual[key]}`);
    }
  }
}
