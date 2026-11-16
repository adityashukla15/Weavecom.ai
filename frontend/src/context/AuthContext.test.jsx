import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  clearLocalSession: vi.fn(),
  getSession: vi.fn(),
  getProfile: vi.fn(),
  onAuthStateChange: vi.fn(),
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock('../api/client.js', () => ({
  setAccessToken: mocks.setAccessToken,
  clearAccessToken: mocks.clearAccessToken,
}));

vi.mock('../api/services/authService.js', () => ({
  authService: {
    signIn: mocks.signIn,
    signUp: mocks.signUp,
    signOut: mocks.signOut,
    clearLocalSession: mocks.clearLocalSession,
    getSession: mocks.getSession,
    getProfile: mocks.getProfile,
    onAuthStateChange: mocks.onAuthStateChange,
  },
}));

vi.mock('../api/supabase.js', () => ({
  supabase: {},
  supabaseConfigurationError: null,
}));

function AuthControls() {
  const { status, user, signIn, signUp } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="role">{user?.role ?? 'none'}</span>
      <button onClick={() => signIn('writer@example.test', 'password')}>Sign in</button>
      <button onClick={() => signUp('new@example.test', 'password')}>Sign up</button>
    </div>
  );
}

describe('AuthProvider integration', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('signs in, verifies the backend profile, and sets its access token', async () => {
    const subscription = { unsubscribe: vi.fn() };
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription } });
    mocks.signIn.mockResolvedValue({
      data: { session: { access_token: 'writer-token' } },
      error: null,
    });
    mocks.getProfile.mockResolvedValue({ id: 'writer-id', role: 'writer' });

    render(<AuthProvider><AuthControls /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    fireEvent.click(screen.getByText('Sign in'));

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('writer'));
    expect(mocks.setAccessToken).toHaveBeenCalledWith('writer-token');
    expect(mocks.getProfile).toHaveBeenCalled();
  });

  it('restores a persisted Supabase session and loads its backend profile', async () => {
    const subscription = { unsubscribe: vi.fn() };
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'restored-token' } },
      error: null,
    });
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription } });
    mocks.getProfile.mockResolvedValue({ id: 'reader-id', role: 'reader' });

    render(<AuthProvider><AuthControls /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('reader'));
    expect(mocks.setAccessToken).toHaveBeenCalledWith('restored-token');
    expect(mocks.getProfile).toHaveBeenCalled();
  });

  it('does not set a role during account creation', async () => {
    const subscription = { unsubscribe: vi.fn() };
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription } });
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });

    render(<AuthProvider><AuthControls /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    fireEvent.click(screen.getByText('Sign up'));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith('new@example.test', 'password'));
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });
});
