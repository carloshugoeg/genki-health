import { asPacienteId } from '@genki/shared';
import { ChargesService } from '../application/full/charges.js';
import { HonorariaService } from '../application/full/honoraria.js';
import { InventoryService } from '../application/full/inventory.js';
import { InvoicingService } from '../application/full/invoicing.js';
import { PaymentsService } from '../application/full/payments.js';
import { PersonnelService } from '../application/full/personnel.js';
import type { AgendaRepositoryPort } from '../ports/full/agenda.js';
import type { EconomicReferences, EconomicStore } from '../ports/full/charges.js';
import type { PacienteRepositoryPort } from '../ports/paciente-repository.js';
import type { Lane1FullModules } from '../ports/adapter-resource.js';

/** Clinical → economic reference bridge for lane A stores. */
export function clinicalEconomicReferences(
  pacientes: PacienteRepositoryPort,
): EconomicReferences {
  return {
    async patient(id: number) {
      const paciente = await pacientes.findById(asPacienteId(id));
      if (!paciente) return null;
      const expediente = await pacientes.findExpedienteByPaciente(paciente.id_paciente);
      if (!expediente) return null;
      return {
        id_paciente: Number(paciente.id_paciente),
        id_expediente: Number(expediente.id_expediente),
      };
    },
    async act() {
      return null;
    },
  };
}

export type LaneABModules = Pick<
  Lane1FullModules,
  'agenda' | 'charges' | 'personnel' | 'honoraria' | 'inventory' | 'invoicing' | 'payments'
>;

/** One EconomicStore backs all six economic services; agenda is independent. */
export function laneABModulesFrom(
  store: EconomicStore,
  agenda: AgendaRepositoryPort,
): LaneABModules {
  return {
    agenda,
    charges: new ChargesService(store),
    personnel: new PersonnelService(store),
    honoraria: new HonorariaService(store),
    inventory: new InventoryService(store),
    invoicing: new InvoicingService(store),
    payments: new PaymentsService(store),
  };
}
