import { describe, expect, it } from 'vitest';
import { archivedEstado, assertCanArchive } from './expediente-estado.js';

describe('assertCanArchive', () => {
  it('allows activo with a reason', () => {
    expect(() => assertCanArchive('activo', 'transferencia')).not.toThrow();
  });

  it('rejects empty reason', () => {
    expect(() => assertCanArchive('activo', '  ')).toThrow(/motivo_archivo/);
  });

  it('rejects already archivado', () => {
    expect(() => assertCanArchive('archivado', 'otra')).toThrow(/already/);
  });

  it('returns archivado estado', () => {
    expect(archivedEstado()).toBe('archivado');
  });
});
