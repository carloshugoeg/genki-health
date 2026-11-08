/** Full-system DTOs for module `charges` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { SERVICIO_FACTURABLE, CARGO, COMANDO_IDEMPOTENTE } from './schema.js';

export type CargoInput = {
  id_paciente: number;
  codigo_servicio: string;
  origen: 'manual' | 'consulta' | 'procedimiento' | 'estancia' | 'insumo' | 'honorario' | 'examen';
  id_consulta?: number;
  id_procedimiento?: number;
  id_admision?: number;
  id_consumo?: number;
  id_participacion?: number;
  cantidad: string;
  clave_evento: string;
};
export type DisposicionInput = {
  estado: 'anulado' | 'cortesia';
  motivo: string;
};
export type CargoCaja = {
  id_cargo: number;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  estado: string;
};
export type InvoicePreview = {
  cargos: CargoCaja[];
  subtotal: string;
  impuesto: string;
  total: string;
  preview_hash: string;
};
