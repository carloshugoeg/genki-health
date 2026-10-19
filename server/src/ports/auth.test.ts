import { describe, expect, it } from 'vitest';
import { NeedsHumanAuthAdapter } from '../adapters/memory/auth.js';
import { AuthNotConfiguredError } from './auth.js';

describe('NeedsHumanAuthAdapter', () => {
  it('fails closed on login', async () => {
    const auth = new NeedsHumanAuthAdapter();
    await expect(auth.login({ nombre_usuario: 'x', contrasena: 'y' })).rejects.toBeInstanceOf(
      AuthNotConfiguredError,
    );
  });
});
