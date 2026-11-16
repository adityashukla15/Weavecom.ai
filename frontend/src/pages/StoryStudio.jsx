import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/errors.js';
import { storyService } from '../api/services/storyService.js';

const emptyStory = {
  project_id: '',
  title: '',
  description: '',
  genre: '',
  synopsis: '',
  main_plot: '',
  status: 'draft',
};

function StoryForm({ story, projects, onChange, onSubmit, onCancel, busy, error, editing }) {
  const wordCount = story.main_plot.split(/\s+/).filter(Boolean).length;
  return (
    <form className="card story-editor" onSubmit={onSubmit}>
      <div className="row sp">
        <h2>{editing ? 'Edit story' : 'Create story'}</h2>
        <button className="btn g sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <label htmlFor="story-project">Project</label>
      <select id="story-project" required value={story.project_id} onChange={(event) => onChange('project_id', event.target.value)}>
        <option value="">Select a project</option>
        {projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}
      </select>
      <label htmlFor="story-title">Title</label>
      <input id="story-title" required maxLength={160} value={story.title} onChange={(event) => onChange('title', event.target.value)} />
      <label htmlFor="story-description">Short description</label>
      <textarea id="story-description" rows="2" maxLength={500} value={story.description} onChange={(event) => onChange('description', event.target.value)} />
      <div className="row">
        <label className="story-field">
          Genre
          <input maxLength={80} value={story.genre} onChange={(event) => onChange('genre', event.target.value)} />
        </label>
        <label className="story-field">
          Status
          <select value={story.status} onChange={(event) => onChange('status', event.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>
      <label htmlFor="story-synopsis">Synopsis</label>
      <textarea id="story-synopsis" rows="4" maxLength={5000} value={story.synopsis} onChange={(event) => onChange('synopsis', event.target.value)} />
      <div className="row sp">
        <label htmlFor="story-plot">Main plot</label>
        <span className="mu">{wordCount} words</span>
      </div>
      <textarea id="story-plot" rows="12" maxLength={30000} value={story.main_plot} onChange={(event) => onChange('main_plot', event.target.value)} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn" type="submit" disabled={busy || projects.length === 0}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create story'}
        </button>
      </div>
    </form>
  );
}

function StoryDetails({ story, projectName, onEdit, onDelete, deleting }) {
  if (!story) {
    return <section className="card story-detail mu">Select a story to view its details.</section>;
  }
  return (
    <section className="card story-detail">
      <div className="row sp">
        <div>
          <span className="tag">{story.status}</span>
          <h2 style={{ marginTop: 8 }}>{story.title}</h2>
          <span className="mu">{projectName}{story.genre ? ` · ${story.genre}` : ''}</span>
        </div>
      </div>
      <h3>About this story</h3>
      <p>{story.description || <span className="mu">No description yet.</span>}</p>
      <h3>Synopsis</h3>
      <p>{story.synopsis || <span className="mu">No synopsis yet.</span>}</p>
      <h3>Main plot</h3>
      <p className="story-plot">{story.main_plot || <span className="mu">No plot added yet.</span>}</p>
      <div className="card story-note">
        Character links are not part of the current database schema. Manage character records in Character Studio.
      </div>
      <div className="row">
        <button className="btn sm" type="button" onClick={onEdit}>Edit</button>
        <button className="btn g sm" type="button" onClick={onDelete} disabled={deleting}>Delete</button>
      </div>
    </section>
  );
}

export default function StoryStudio() {
  const [stories, setStories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyStory);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projectRows, storyRows] = await Promise.all([
        storyService.listProjects(),
        storyService.list(),
      ]);
      setProjects(projectRows);
      setStories(storyRows);
      setSelectedId((current) => storyRows.some((story) => story.id === current)
        ? current
        : storyRows[0]?.id ?? null);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selected = stories.find((story) => story.id === selectedId) ?? null;
  const projectName = projects.find((project) => project.id === selected?.project_id)?.title ?? 'Project';

  function startCreate() {
    setEditing(false);
    setForm({ ...emptyStory, project_id: projects[0]?.id ?? '' });
    setFormError('');
    setFormOpen(true);
  }

  function startEdit() {
    if (!selected) return;
    setEditing(true);
    setForm({
      project_id: selected.project_id,
      title: selected.title,
      description: selected.description ?? '',
      genre: selected.genre ?? '',
      synopsis: selected.synopsis ?? '',
      main_plot: selected.main_plot ?? '',
      status: selected.status,
    });
    setFormError('');
    setFormOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const story = editing
        ? await storyService.updateById(selected.id, form)
        : await storyService.create(form);
      setStories((current) => editing
        ? current.map((item) => item.id === story.id ? story : item)
        : [story, ...current]);
      setSelectedId(story.id);
      setFormOpen(false);
    } catch (cause) {
      setFormError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected || !window.confirm(`Delete "${selected.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError('');
    try {
      await storyService.removeById(selected.id);
      const remaining = stories.filter((story) => story.id !== selected.id);
      setStories(remaining);
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
          <h1>Story Studio</h1>
          <span className="mu">Shape your story and keep it connected to your projects.</span>
        </div>
        {!formOpen && (
          <button className="btn" type="button" onClick={startCreate} disabled={loading || projects.length === 0}>
            Create story
          </button>
        )}
      </div>
      {error && <p className="auth-error" role="alert">{error} <button className="btn g sm" onClick={loadData}>Retry</button></p>}
      {loading ? (
        <div className="card mu" role="status" style={{ marginTop: 14 }}>Loading stories…</div>
      ) : (
        <div className="cols story-studio-layout">
          <section className="card story-list" aria-label="Stories">
            <div className="row sp">
              <b>Your stories</b>
              <span className="tag">{stories.length}</span>
            </div>
            {stories.length ? stories.map((story) => (
              <button
                type="button"
                className={`story-list-item${selectedId === story.id ? ' selected' : ''}`}
                onClick={() => { setSelectedId(story.id); setFormOpen(false); }}
                key={story.id}
              >
                <b>{story.title}</b>
                <span className="mu">{projects.find((project) => project.id === story.project_id)?.title ?? 'Project'} · {story.status}</span>
              </button>
            )) : (
              <div className="mu story-empty">
                {projects.length
                  ? 'No stories yet. Create a story to start writing.'
                  : 'Create a project first. Stories are saved to a Writer-owned project.'}
              </div>
            )}
            {!formOpen && !stories.length && projects.length > 0 && (
              <button className="btn" type="button" onClick={startCreate}>Create your first story</button>
            )}
          </section>
          {formOpen ? (
            <StoryForm
              story={form}
              projects={projects}
              onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
              onSubmit={submit}
              onCancel={() => setFormOpen(false)}
              busy={saving}
              error={formError}
              editing={editing}
            />
          ) : (
            <>
              <StoryDetails story={selected} projectName={projectName} onEdit={startEdit} onDelete={remove} deleting={deleting} />
              <aside className="card ai story-intelligence">
                <b>Story intelligence</b>
                <p className="mu" style={{ fontSize: 13 }}>
                  AI suggestions are not connected in this milestone. Your saved story content remains unchanged.
                </p>
                {selected && <span className="mu">{selected.main_plot.split(/\s+/).filter(Boolean).length} plot words</span>}
              </aside>
            </>
          )}
        </div>
      )}
    </>
  );
}
