import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useAuth = vi.hoisted(() => vi.fn());

vi.mock('../../context/AuthContext.jsx', () => ({ useAuth }));

import { RequireAuth } from './ProtectedRoute.jsx';

function renderRoute(initialPath, auth) {
  useAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/workspace" element={<p>Workspace</p>} />
        </Route>
        <Route path="/login" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('protected frontend routes', () => {
  afterEach(() => {
    cleanup();
  });

  it('redirects unauthenticated users to sign-in', () => {
    renderRoute('/workspace', { status: 'unauthenticated' });

    expect(screen.getByText('Sign-in page')).toBeTruthy();
  });

  it('allows any authenticated user, including users without a role', () => {
    renderRoute('/workspace', {
      status: 'authenticated',
      user: { role: null },
    });

    expect(screen.getByText('Workspace')).toBeTruthy();
  });
});
