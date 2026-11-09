import { agendaContract } from '../agenda.contract.js';
import { MemoryAgendaRepository } from '../../../src/adapters/memory/full/agenda.js';
agendaContract('Memory agenda contract (not native evidence)', async () => new MemoryAgendaRepository());
