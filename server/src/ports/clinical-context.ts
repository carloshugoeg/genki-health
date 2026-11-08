import type { CatalogoRepositoryPort } from './catalogo-repository.js';
import type { ClockPort } from './clock.js';
import type { ConsultaRepositoryPort } from './consulta-repository.js';
import type { IdPort } from './id.js';
import type { PacienteRepositoryPort } from './paciente-repository.js';
import type { UnitOfWorkPort } from './unit-of-work.js';

export interface ClinicalContext {
  readonly pacientes: PacienteRepositoryPort;
  readonly consultas: ConsultaRepositoryPort;
  readonly catalogos: CatalogoRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
}
