import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CharacterArt from '../components/common/CharacterArt.jsx';
import { getErrorMessage } from '../api/errors.js';
import { projectService } from '../api/services/projectService.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Fantasy');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const toast = useToast();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProjects(await projectService.listAccessible());
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && !dialog.open) dialog.showModal();
    if (!dialogOpen && dialog.open) dialog.close();
  }, [dialogOpen]);

  async function createProject(event) {
    event.preventDefault();
    const name = title.trim();
    if (name.length < 3) {
      setError('Project title needs at least 3 characters.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const project = await projectService.createProject({
        title: name,
        description: description.trim(),
        genre,
        status: 'draft',
      });
      setProjects((current) => [project, ...current]);
      setDialogOpen(false);
      setTitle('');
      setDescription('');
      toast('Project saved');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="row sp">
        <div>
          <h1>Welcome back, creator</h1>
          <span className="mu">{projects.length} saved projects</span>
        </div>
        <button className="btn" type="button" onClick={() => { setError(''); setDialogOpen(true); }}>Create project</button>
      </div>

      <div className="grid" style={{ margin: '20px 0' }}>
        {[
          ['Projects', projects.length],
          ['Drafts', projects.filter((project) => project.status === 'draft').length],
          ['Published', projects.filter((project) => project.status === 'published').length],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <div className="mu">{label}</div>
            <h2>{value}</h2>
          </div>
        ))}
      </div>

      <div className="row sp">
        <h2>Projects</h2>
        <Link className="btn g sm" to="/assistant">Ask Project Assistant</Link>
      </div>
      {error && <p className="auth-error" role="alert">{error} <button type="button" className="btn g sm" onClick={loadProjects}>Retry</button></p>}
      {loading ? (
        <div className="card mu" role="status">Loading saved projects…</div>
      ) : projects.length ? (
        <div className="grid" style={{ marginTop: 10 }}>
          {projects.map((project, index) => (
            <article className="card" key={project.id}>
              <CharacterArt index={index} label={project.title} />
              <div className="row sp" style={{ marginTop: 10 }}>
                <b>{project.title}</b>
                <span className="tag" style={{ color: project.status === 'published' ? 'var(--ok)' : 'var(--wa)' }}>{project.status}</span>
              </div>
              <p className="mu">{project.description || 'No description yet.'}</p>
              <span className="mu" style={{ fontSize: 13 }}>
                {project.genre || 'Uncategorized'} · {project.page_count}/{project.page_target} pages
              </span>
              <div className="row button-row" style={{ marginTop: 10 }}>
                <Link className="btn g sm" to="/characters">Characters</Link>
                <Link className="btn g sm" to="/story">Stories</Link>
                <Link className="btn g sm" to="/comic">Comics</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h3>No saved projects yet</h3>
          <p className="mu">Create a project to start saving characters, stories, and comics.</p>
          <button className="btn" type="button" onClick={() => setDialogOpen(true)}>Create your first project</button>
        </div>
      )}

      {dialogOpen && (
        <dialog ref={dialogRef} className="dialog-card" aria-labelledby="new-project-title" onClose={() => setDialogOpen(false)}>
          <form onSubmit={createProject}>
            <h3 id="new-project-title">New project</h3>
            <p className="mu">Create a project to organize your saved story and character work.</p>
            <label htmlFor="project-title">Title</label>
            <input id="project-title" autoFocus required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Project title" />
            <label htmlFor="project-description">Description</label>
            <textarea id="project-description" rows="3" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
            <label htmlFor="project-genre">Genre</label>
            <select id="project-genre" value={genre} onChange={(event) => setGenre(event.target.value)}>
              {['Fantasy', 'Sci-fi', 'Noir', 'Horror', 'Other'].map((option) => <option key={option}>{option}</option>)}
            </select>
            {error && <p className="modal-error" role="alert">{error}</p>}
            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button type="button" className="btn g" onClick={() => { setDialogOpen(false); setError(''); }}>Cancel</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create project'}</button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
