import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    signIn: mocks.signIn,
    signUp: mocks.signUp,
  }),
}));

vi.mock('../api/client.js', () => ({ isApiConfigured: true }));
vi.mock('../api/supabase.js', () => ({ supabaseConfigurationError: null }));

import AuthPage from './AuthPage.jsx';

function renderAuthPage(mode) {
  return render(
    <MemoryRouter initialEntries={[mode === 'signup' ? '/signup' : '/login']}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('email and password authentication form', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('signs in without role selection and redirects to the dashboard', async () => {
    mocks.signIn.mockResolvedValue({ profile: { id: 'user-id' } });
    renderAuthPage('login');

    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.queryByText(/Reader|Writer/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: '  user@example.test  ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'strong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith(
      'user@example.test',
      'strong-password',
    ));
    expect(await screen.findByText('Dashboard page')).toBeTruthy();
  });

  it('registers without role data and shows confirmation guidance', async () => {
    mocks.signUp.mockResolvedValue({ session: null });
    renderAuthPage('signup');
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'strong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith(
      'new@example.test',
      'strong-password',
    ));
    expect((await screen.findByRole('status')).textContent).toContain(
      'Check your email to confirm your account, then sign in.',
    );
  });

  it('shows Supabase authentication errors instead of a generic message', async () => {
    mocks.signIn.mockRejectedValue(new Error('Invalid login credentials'));
    renderAuthPage('login');
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Invalid login credentials',
    );
  });

  it('shows duplicate-email registration errors', async () => {
    mocks.signUp.mockRejectedValue(new Error('User already registered'));
    renderAuthPage('signup');
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'existing@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'strong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'User already registered',
    );
  });
});
