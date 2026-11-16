import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/errors.js';
import { characterService } from '../api/services/characterService.js';

const emptyForm = {
  project_id: '',
  name: '',
  description: '',
  personality: '',
  appearance: '',
  background: '',
  role: 'supporting',
  image_url: '',
};

function CharacterFields({ form, projects, onChange, onSubmit, onCancel, busy, error, editing }) {
  return (
    <form className="card character-form" onSubmit={onSubmit}>
      <div className="row sp">
        <h2>{editing ? 'Edit character' : 'Create character'}</h2>
        <button className="btn g sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <label htmlFor="character-project">Project</label>
      <select
        id="character-project"
        required
        value={form.project_id}
        onChange={(event) => onChange('project_id', event.target.value)}
      >
        <option value="">Select a project</option>
        {projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}
      </select>
      <label htmlFor="character-name">Name</label>
      <input id="character-name" required maxLength={120} value={form.name} onChange={(event) => onChange('name', event.target.value)} />
      <label htmlFor="character-role">Role</label>
      <select id="character-role" value={form.role} onChange={(event) => onChange('role', event.target.value)}>
        <option value="protagonist">Protagonist</option>
        <option value="antagonist">Antagonist</option>
        <option value="supporting">Supporting</option>
      </select>
      <label htmlFor="character-description">Short description</label>
      <textarea id="character-description" rows="2" maxLength={500} value={form.description} onChange={(event) => onChange('description', event.target.value)} />
      <label htmlFor="character-personality">Personality</label>
      <textarea id="character-personality" rows="3" maxLength={2000} value={form.personality} onChange={(event) => onChange('personality', event.target.value)} />
      <label htmlFor="character-appearance">Appearance</label>
      <textarea id="character-appearance" rows="3" maxLength={2000} value={form.appearance} onChange={(event) => onChange('appearance', event.target.value)} />
      <label htmlFor="character-background">Background / story</label>
      <textarea id="character-background" rows="4" maxLength={5000} value={form.background} onChange={(event) => onChange('background', event.target.value)} />
      <label htmlFor="character-image">Visual reference URL (optional)</label>
      <input id="character-image" type="url" value={form.image_url} onChange={(event) => onChange('image_url', event.target.value)} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn" type="submit" disabled={busy || projects.length === 0}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create character'}
        </button>
      </div>
    </form>
  );
}

function CharacterDetails({ character, projectName, onEdit, onDelete, busy }) {
  if (!character) {
    return <section className="card mu character-detail">Select a character to view details.</section>;
  }
  return (
    <section className="card character-detail" aria-label="Character details">
      <div className="row sp">
        <div>
          <span className="tag">{character.role}</span>
          <h2 style={{ marginTop: 8 }}>{character.name}</h2>
          <span className="mu">{projectName}</span>
        </div>
        {character.image_url && <img className="character-reference" src={character.image_url} alt={`${character.name} reference`} />}
      </div>
      <p>{character.description || <span className="mu">No description yet.</span>}</p>
      <h3>Personality</h3>
      <p>{character.personality || <span className="mu">Not added yet.</span>}</p>
      <h3>Appearance</h3>
      <p>{character.appearance || <span className="mu">Not added yet.</span>}</p>
      <h3>Background / story</h3>
      <p>{character.background || <span className="mu">Not added yet.</span>}</p>
      <div className="row">
        <button className="btn sm" type="button" onClick={onEdit}>Edit</button>
        <button className="btn g sm" type="button" onClick={onDelete} disabled={busy}>Delete</button>
      </div>
    </section>
  );
}

export default function CharacterStudio() {
  const [characters, setCharacters] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projectRows, characterRows] = await Promise.all([
        characterService.listProjects(),
        characterService.list(),
      ]);
      setProjects(projectRows);
      setCharacters(characterRows);
      setSelectedId((current) => characterRows.some((item) => item.id === current)
        ? current
        : characterRows[0]?.id ?? null);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selected = characters.find((item) => item.id === selectedId) ?? null;
  const projectName = projects.find((project) => project.id === selected?.project_id)?.title ?? 'Project';

  function startCreate() {
    setEditing(false);
    setForm({ ...emptyForm, project_id: projects[0]?.id ?? '' });
    setFormError('');
    setFormOpen(true);
  }

  function startEdit() {
    if (!selected) return;
    setEditing(true);
    setForm({
      project_id: selected.project_id,
      name: selected.name,
      description: selected.description ?? '',
      personality: selected.personality ?? '',
      appearance: selected.appearance ?? '',
      background: selected.background ?? '',
      role: selected.role,
      image_url: selected.image_url ?? '',
    });
    setFormError('');
    setFormOpen(true);
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      ...form,
      image_url: form.image_url.trim() || null,
    };
    try {
      const character = editing
        ? await characterService.update(selected.id, payload)
        : await characterService.create(payload);
      setCharacters((current) => editing
        ? current.map((item) => item.id === character.id ? character : item)
        : [character, ...current]);
      setSelectedId(character.id);
      setFormOpen(false);
    } catch (cause) {
      setFormError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected || !window.confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
    setDeleting(true);
    setError('');
    try {
      await characterService.remove(selected.id);
      const remaining = characters.filter((item) => item.id !== selected.id);
      setCharacters(remaining);
      setSelectedId(remaining[0]?.id ?? null);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="row sp">
        <div>
          <h1>Character Studio</h1>
          <span className="mu">Build and manage characters across your projects.</span>
        </div>
        {!formOpen && (
          <button className="btn" type="button" onClick={startCreate} disabled={loading || projects.length === 0}>
            Create character
          </button>
        )}
      </div>
      {error && <p className="auth-error" role="alert">{error} <button className="btn g sm" onClick={loadData}>Retry</button></p>}
      {loading ? (
        <div className="card mu" role="status" style={{ marginTop: 14 }}>Loading characters…</div>
      ) : (
        <div className="character-studio-layout">
          <section className="card character-list" aria-label="Characters">
            <div className="row sp">
              <h2>Your characters</h2>
              <span className="tag">{characters.length}</span>
            </div>
            {characters.length ? characters.map((character) => (
              <button
                type="button"
                className={`character-list-item${selectedId === character.id ? ' selected' : ''}`}
                onClick={() => { setSelectedId(character.id); setFormOpen(false); }}
                key={character.id}
              >
                <b>{character.name}</b>
                <span className="mu">{projects.find((project) => project.id === character.project_id)?.title ?? 'Project'} · {character.role}</span>
              </button>
            )) : (
              <div className="mu character-empty">
                {projects.length
                  ? 'No characters yet. Create one to start building your cast.'
                  : 'Create a project first. Characters are saved to a Writer-owned project.'}
              </div>
            )}
            {!formOpen && !characters.length && projects.length > 0 && (
              <button className="btn" type="button" onClick={startCreate}>Create your first character</button>
            )}
          </section>
          <div className="character-main">
            {formOpen ? (
              <CharacterFields
                form={form}
                projects={projects}
                onChange={updateField}
                onSubmit={submit}
                onCancel={() => setFormOpen(false)}
                busy={saving}
                error={formError}
                editing={editing}
              />
            ) : (
              <CharacterDetails
                character={selected}
                projectName={projectName}
                onEdit={startEdit}
                onDelete={remove}
                busy={deleting}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
