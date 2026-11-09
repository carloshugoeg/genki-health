import { describe, expect, it } from 'vitest';
import { FirebaseId } from '../../../src/adapters/firebase/id.js';

function stubIds() {
  const calls: string[] = [];
  const ids = new FirebaseId({
    nextCounter: async (sequence: string) => {
      calls.push(sequence);
      return 7;
    },
  } as never);
  return { ids, calls };
}

describe('FirebaseId', () => {
  it('allocates sesion_tratamiento for OP59 real-mode writes', async () => {
    const { ids, calls } = stubIds();
    await expect(ids.nextInt('sesion_tratamiento')).resolves.toBe(7);
    expect(calls).toEqual(['sesion_tratamiento']);
  });

  it('allocates reactivacion_audit for OP19', async () => {
    const { ids, calls } = stubIds();
    await expect(ids.nextInt('reactivacion_audit')).resolves.toBe(7);
    expect(calls).toEqual(['reactivacion_audit']);
  });

  it('rejects unknown counters', async () => {
    const { ids } = stubIds();
    await expect(ids.nextInt('no_such_counter')).rejects.toThrow('Unknown Firestore counter');
  });
});
