import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useAuth = vi.hoisted(() => vi.fn());

vi.mock('../../context/AuthContext.jsx', () => ({ useAuth }));

import { RequireAuth, RequireRole } from './ProtectedRoute.jsx';

function renderRoute(initialPath, auth, role) {
  useAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<RequireRole roles={role} />}>
            <Route path="/workspace" element={<p>Writer workspace</p>} />
          </Route>
          <Route element={<RequireRole roles={['writer', 'reader']} />}>
            <Route path="/community" element={<p>Published community</p>} />
          </Route>
        </Route>
        <Route path="/login" element={<p>Sign-in page</p>} />
        <Route path="/access-pending" element={<p>Role pending</p>} />
        <Route path="/forbidden" element={<p>Forbidden page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('protected frontend routes', () => {
  afterEach(() => {
    cleanup();
  });

  it('redirects unauthenticated users to sign-in', () => {
    renderRoute('/workspace', { status: 'unauthenticated' }, ['writer']);

    expect(screen.getByText('Sign-in page')).toBeTruthy();
  });

  it('allows Writers into Writer functionality', () => {
    renderRoute('/workspace', {
      status: 'authenticated',
      user: { role: 'writer' },
    }, ['writer']);

    expect(screen.getByText('Writer workspace')).toBeTruthy();
  });

  it('denies Readers Writer functionality but allows the community route', () => {
    const auth = { status: 'authenticated', user: { role: 'reader' } };
    const { unmount } = renderRoute('/workspace', auth, ['writer']);
    expect(screen.getByText('Forbidden page')).toBeTruthy();
    unmount();

    renderRoute('/community', auth, ['writer']);
    expect(screen.getByText('Published community')).toBeTruthy();
  });

  it('holds authenticated users without a trusted role at access pending', () => {
    renderRoute('/workspace', {
      status: 'authenticated',
      user: { role: null },
    }, ['writer']);

    expect(screen.getByText('Role pending')).toBeTruthy();
  });
});
