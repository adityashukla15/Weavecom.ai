import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  listProjects: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../api/services/characterService.js', () => ({
  characterService: mocks,
}));

import CharacterStudio from './CharacterStudio.jsx';

const project = { id: 'project-id', title: 'My Comic' };

function savedCharacter(overrides = {}) {
  return {
    id: 'character-id',
    project_id: project.id,
    name: 'Kaito',
    role: 'protagonist',
    description: 'A young hero.',
    personality: '',
    appearance: '',
    background: '',
    image_url: null,
    ...overrides,
  };
}

describe('CharacterStudio', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('creates, edits, and deletes a persisted character through the API service', async () => {
    mocks.listProjects.mockResolvedValue([project]);
    mocks.list.mockResolvedValue([]);
    mocks.create.mockResolvedValue(savedCharacter());
    mocks.update.mockResolvedValue(savedCharacter({ name: 'Kaito Ardent' }));
    mocks.remove.mockResolvedValue(null);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CharacterStudio />);
    await screen.findByText('No characters yet. Create one to start building your cast.');
    fireEvent.click(screen.getAllByRole('button', { name: 'Create character' })[0]);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kaito' } });
    fireEvent.change(screen.getByLabelText('Short description'), { target: { value: 'A young hero.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create character', exact: true }));

    await screen.findByRole('heading', { name: 'Kaito' });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      project_id: project.id,
      name: 'Kaito',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kaito Ardent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { name: 'Kaito Ardent' });
    expect(mocks.update).toHaveBeenCalledWith(
      'character-id',
      expect.objectContaining({ name: 'Kaito Ardent' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('character-id'));
    expect(await screen.findByText('No characters yet. Create one to start building your cast.')).toBeTruthy();
  });
});
