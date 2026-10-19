import type {
  ConsultaDto,
  ConsultaId,
  DetalleRecetaDto,
  DiagnosticoDto,
  RecetaDto,
  TratamientoDto,
} from '@genki/shared';

/** Atomic close of a consultation (locked clinical rule). */
export interface CloseConsultaBundle {
  consulta: Omit<ConsultaDto, 'id_consulta'>;
  diagnosticos: ReadonlyArray<Omit<DiagnosticoDto, 'id_diagnostico' | 'id_consulta'>>;
  tratamientos: ReadonlyArray<
    Omit<TratamientoDto, 'id_tratamiento' | 'id_diagnostico'> & { diagnostico_index: number }
  >;
  receta?: {
    header: Omit<RecetaDto, 'id_receta' | 'id_consulta'>;
    detalles: ReadonlyArray<Omit<DetalleRecetaDto, 'id_receta'>>;
  };
}

export interface ConsultaRepositoryPort {
  closeConsulta(bundle: CloseConsultaBundle): Promise<{
    consulta: ConsultaDto;
    diagnosticos: DiagnosticoDto[];
    tratamientos: TratamientoDto[];
    receta: RecetaDto | null;
  }>;
  findById(id: ConsultaId): Promise<ConsultaDto | null>;
}
