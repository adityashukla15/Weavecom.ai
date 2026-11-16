import { describe, expect, it, vi } from 'vitest';

const signUp = vi.hoisted(() => vi.fn());

vi.mock('../supabase.js', () => ({
  supabase: { auth: { signUp } },
  supabaseConfigurationError: null,
}));

import { authService } from './authService.js';

describe('authService', () => {
  it('does not allow signup callers to provide trusted role metadata', async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });

    await authService.signUp('reader@example.test', 'strong-password');

    expect(signUp).toHaveBeenCalledWith({
      email: 'reader@example.test',
      password: 'strong-password',
    });
  });
});
