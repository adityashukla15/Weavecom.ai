import { afterEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({ createClient }));

describe('user-scoped Supabase client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('requires an authenticated session and returns the publishable-key client', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'user-token' } },
          error: null,
        }),
      },
    };
    createClient.mockReturnValue(client);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
    vi.resetModules();
    const { getUserScopedSupabaseClient } = await import('./supabase.js');

    await expect(getUserScopedSupabaseClient()).resolves.toBe(client);
    expect(createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'publishable-key',
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: true }) }),
    );
  });

  it('refuses RLS data access when there is no authenticated session', async () => {
    createClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    });
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
    vi.resetModules();
    const { getUserScopedSupabaseClient } = await import('./supabase.js');

    await expect(getUserScopedSupabaseClient()).rejects.toThrow('Sign in before accessing protected content.');
  });
});
