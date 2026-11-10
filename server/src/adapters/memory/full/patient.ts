import type { InstitutionId, PacienteDto, PacienteResumen } from '@genki/shared';
import type { CONTACTO_EMERGENCIA } from '@genki/shared/full/patient';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  Op07Request,
  Op07Response,
  Op08Request,
  Op08Response,
  Op09Request,
  Op09Response,
  Op10Request,
  Op10Response,
  Op11Request,
  Op11Response,
  Op13Request,
  Op13Response,
  PatientRepositoryPort,
} from '../../../ports/full/patient.js';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { contactIdentityKey, normalizeDocumento } from '../../../domain/full/patient.js';
import {
  getExtensionNamespace,
  putExtensionRow,
  type MemoryExtensionNamespace,
} from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const PATIENT_SLUG = 'patient';
const CONTACTOS = 'contactos';

export interface MemoryPatientRepositoryOptions {
  state: MemoryInstitutionState;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  id_institucion: InstitutionId;
  clock: ClockPort;
}

function cloneDto<T>(value: T): T {
  return structuredClone(value);
}

function contactRows(namespace: MemoryExtensionNamespace): Map<number, CONTACTO_EMERGENCIA> {
  let rows = namespace.get(CONTACTOS) as Map<number, CONTACTO_EMERGENCIA> | undefined;
  if (!rows) {
    rows = new Map();
    namespace.set(CONTACTOS, rows);
  }
  return rows;
}

export class MemoryPatientRepository implements PatientRepositoryPort {
  private storeDown = false;
  private writesRemaining: number | null = null;

  constructor(private readonly options: MemoryPatientRepositoryOptions) {}

  failAfterWrite(n: number): void {
    if (n === 0) {
      this.storeDown = true;
      this.writesRemaining = null;
      return;
    }
    this.storeDown = false;
    this.writesRemaining = n;
  }

  resetFaults(): void {
    this.storeDown = false;
    this.writesRemaining = null;
  }

  private assertStoreUp(): void {
    if (this.storeDown) {
      throw new ClinicalError('store_unavailable', 'Almacén no disponible');
    }
  }

  private noteWrite(): void {
    this.assertStoreUp();
    if (this.writesRemaining === null) {
      return;
    }
    this.writesRemaining -= 1;
    if (this.writesRemaining === 0) {
      throw new ClinicalError('internal_error', 'Fallo inyectado a media escritura');
    }
  }

  private requirePaciente(id: number, actor: OperationContext): PacienteDto {
    const maps = activeMemoryMaps(this.options.state);
    const found = maps.pacientes.get(id as PacienteDto['id_paciente']);
    if (!found || found.id_institucion !== actor.id_institucion) {
      throw new ClinicalError('not_found', 'Paciente no encontrado');
    }
    if (found.id_institucion !== this.options.id_institucion) {
      throw new ClinicalError('not_found', 'Paciente no encontrado');
    }
    return found;
  }

  private resumenFor(paciente: PacienteDto): PacienteResumen {
    const maps = activeMemoryMaps(this.options.state);
    const expediente = maps.expedientes.get(paciente.id_paciente);
    if (!expediente) {
      throw new ClinicalError('not_found', 'Expediente no encontrado');
    }
    return { paciente: cloneDto(paciente), expediente: cloneDto(expediente) };
  }

  async op07(_input: Op07Request, _context: OperationContext): Promise<Op07Response> {
    throw new ClinicalError('misconfigured', 'OP-07 fuera de FS-03-C01');
  }

  async op08(_input: Op08Request, _context: OperationContext): Promise<Op08Response> {
    throw new ClinicalError('misconfigured', 'OP-08 fuera de FS-03-C01');
  }

  async op09(input: Op09Request, context: OperationContext): Promise<Op09Response> {
    this.assertStoreUp();
    const current = this.requirePaciente(input.params.id, context);
    const maps = activeMemoryMaps(this.options.state);
    const patch = input.body;

    if (patch.numero_documento !== undefined) {
      const numero = normalizeDocumento(patch.numero_documento);
      for (const other of maps.pacientes.values()) {
        if (other.id_paciente !== current.id_paciente && other.numero_documento === numero) {
          throw new ClinicalError(
            'duplicate_document',
            'Documento ya registrado en esta institución',
          );
        }
      }
    }

    const next: PacienteDto = {
      ...current,
      ...(patch.tipo_documento !== undefined ? { tipo_documento: patch.tipo_documento } : {}),
      ...(patch.numero_documento !== undefined
        ? { numero_documento: normalizeDocumento(patch.numero_documento) }
        : {}),
      ...(patch.primer_nombre !== undefined ? { primer_nombre: patch.primer_nombre } : {}),
      ...(patch.segundo_nombre !== undefined
        ? { segundo_nombre: patch.segundo_nombre ?? null }
        : {}),
      ...(patch.primer_apellido !== undefined ? { primer_apellido: patch.primer_apellido } : {}),
      ...(patch.segundo_apellido !== undefined
        ? { segundo_apellido: patch.segundo_apellido ?? null }
        : {}),
      ...(patch.fecha_nacimiento !== undefined ? { fecha_nacimiento: patch.fecha_nacimiento } : {}),
      ...(patch.sexo !== undefined ? { sexo: patch.sexo } : {}),
      ...(patch.tipo_sangre !== undefined ? { tipo_sangre: patch.tipo_sangre ?? null } : {}),
      ...(patch.telefono !== undefined ? { telefono: patch.telefono ?? null } : {}),
      ...(patch.correo !== undefined ? { correo: patch.correo ?? null } : {}),
      ...(patch.direccion !== undefined ? { direccion: patch.direccion ?? null } : {}),
      ...(patch.id_municipio !== undefined ? { id_municipio: patch.id_municipio ?? null } : {}),
      id_paciente: current.id_paciente,
      id_institucion: current.id_institucion,
      fecha_registro: current.fecha_registro,
      estado: current.estado,
    };

    maps.pacientes.set(current.id_paciente, next);
    this.noteWrite();
    return this.resumenFor(next);
  }

  async op10(input: Op10Request, context: OperationContext): Promise<Op10Response> {
    this.assertStoreUp();
    const paciente = this.requirePaciente(input.params.id, context);
    const maps = activeMemoryMaps(this.options.state);
    const namespace = getExtensionNamespace(maps, PATIENT_SLUG);
    const rows = contactRows(namespace);
    const body = input.body;
    const identity = contactIdentityKey(body.nombre_completo, body.telefono);

    for (const row of rows.values()) {
      if (
        row.id_paciente === paciente.id_paciente &&
        contactIdentityKey(row.nombre_completo, row.telefono) === identity
      ) {
        throw new ClinicalError('conflict', 'Contacto de emergencia ya registrado');
      }
    }

    if (body.es_principal) {
      for (const [id, row] of rows.entries()) {
        if (row.id_paciente === paciente.id_paciente && row.es_principal) {
          rows.set(id, { ...row, es_principal: false });
          this.noteWrite();
        }
      }
    }

    const id_contacto = await this.options.ids.nextInt('contacto_emergencia');
    const created: CONTACTO_EMERGENCIA = {
      id_contacto,
      id_paciente: paciente.id_paciente,
      nombre_completo: body.nombre_completo,
      parentesco: body.parentesco,
      telefono: body.telefono,
      telefono_alterno: body.telefono_alterno ?? null,
      es_principal: body.es_principal,
    };
    putExtensionRow(namespace, CONTACTOS, id_contacto, created);
    rows.set(id_contacto, created);
    this.noteWrite();
    return cloneDto(created);
  }

  async op11(_input: Op11Request, _context: OperationContext): Promise<Op11Response> {
    throw new ClinicalError('misconfigured', 'OP-11 fuera de FS-03-C01');
  }

  async op13(_input: Op13Request, _context: OperationContext): Promise<Op13Response> {
    throw new ClinicalError('misconfigured', 'OP-13 fuera de FS-03-C01');
  }
}
