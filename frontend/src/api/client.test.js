import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAccessToken, request, setAccessToken } from './client.js';

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('backend API authentication', () => {
  it('attaches the current Supabase access token to protected API requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('test-access-token');

    await request('/api/v1/auth/me');

    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-access-token');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
  });

  it('clears authentication on 401 but keeps 403 as an authorization failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"error":"forbidden"}', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const unauthorized = vi.fn();
    window.addEventListener('panelverse:unauthorized', unauthorized);

    await expect(request('/protected')).rejects.toMatchObject({ status: 401 });
    await expect(request('/writer-only')).rejects.toMatchObject({ status: 403 });

    expect(unauthorized).toHaveBeenCalledTimes(1);
    window.removeEventListener('panelverse:unauthorized', unauthorized);
  });
});
