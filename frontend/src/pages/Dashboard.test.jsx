import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext.jsx';

const mocks = vi.hoisted(() => ({
  listAccessible: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock('../api/services/projectService.js', () => ({
  projectService: mocks,
}));

import Dashboard from './Dashboard.jsx';

describe('Dashboard project integration', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('creates a project through the backend service and displays the saved project', async () => {
    mocks.listAccessible.mockResolvedValue([]);
    mocks.createProject.mockResolvedValue({
      id: 'saved-project-id',
      title: 'Ember City',
      description: 'A story project.',
      genre: 'Fantasy',
      status: 'draft',
      page_count: 0,
      page_target: 20,
    });
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    HTMLDialogElement.prototype.close = function close() { this.open = false; };

    render(
      <MemoryRouter>
        <ToastProvider>
          <Dashboard />
        </ToastProvider>
      </MemoryRouter>,
    );

    await screen.findByText('No saved projects yet');
    fireEvent.click(screen.getAllByRole('button', { name: 'Create project' })[0]);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Ember City' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A story project.' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create project' }).at(-1));

    expect(await screen.findAllByText('Ember City')).toHaveLength(2);
    expect(mocks.createProject).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Ember City',
      description: 'A story project.',
      status: 'draft',
    }));
    expect(screen.getByRole('link', { name: 'Stories' })).toBeTruthy();
  });
});
