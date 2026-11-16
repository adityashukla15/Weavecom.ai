import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CharacterArt from '../components/common/CharacterArt.jsx';
import { characters } from '../data/demoData.js';
import { useAppData } from '../context/AppContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Dashboard() {
  const { projects, setProjects } = useAppData();
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Fantasy');
  const [error, setError] = useState('');
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && !dialog.open) dialog.showModal();
    if (!dialogOpen && dialog.open) dialog.close();
  }, [dialogOpen]);

  function createProject(event) {
    event.preventDefault();
    const name = title.trim();
    if (name.length < 3) {
      setError('Title needs at least 3 characters.');
      return;
    }
    setProjects((current) => [{ n: name, st: 'Draft', pg: 0, of: 20 }, ...current]);
    setDialogOpen(false);
    setTitle('');
    setError('');
    toast(`Comic created · ${genre}`);
  }

  return (
    <>
      <div className="row sp">
        <div>
          <h1>Welcome back, creator</h1>
          <span className="mu">{projects.length} projects · {characters.length} characters</span>
        </div>
        <button className="btn" onClick={() => setDialogOpen(true)}>Create new comic</button>
      </div>

      <div className="grid" style={{ margin: '20px 0' }}>
        {[
          ['Pages drawn', 51],
          ['Characters', characters.length],
          ['AI edits accepted', 38],
          ['Storage', '2.1 / 10 GB'],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <div className="mu">{label}</div>
            <h2>{value}</h2>
          </div>
        ))}
      </div>

      <h3>Projects</h3>
      {projects.length ? (
        <div className="grid" style={{ marginTop: 10 }}>
          {projects.map((project, index) => (
            <Link to="/comic" className="card landing-link" key={`${project.n}-${index}`}>
              <CharacterArt index={index} label={project.n} />
              <div className="row sp" style={{ marginTop: 10 }}>
                <b>{project.n}</b>
                <span className="tag" style={{ color: project.st === 'Published' ? 'var(--ok)' : 'var(--wa)' }}>{project.st}</span>
              </div>
              <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, marginTop: 8 }}>
                <div style={{ height: '100%', width: `${project.pg / project.of * 100}%`, background: 'var(--p)', borderRadius: 3 }} />
              </div>
              <span className="mu" style={{ fontSize: 13 }}>{project.pg}/{project.of} pages</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>No comics yet. Create your first project to begin.</div>
      )}

      <h3 style={{ margin: '24px 0 10px' }}>Recent AI activity</h3>
      <div className="card mu">Plot check on “Chronicles of Kaito”: 3 findings · Character match: Hana Mirei (suggested) · Panel 4 regenerated (demo)</div>

      {dialogOpen && (
        <dialog ref={dialogRef} className="dialog-card" aria-labelledby="new-comic-title" onClose={() => setDialogOpen(false)}>
          <form onSubmit={createProject}>
            <h3 id="new-comic-title">New comic</h3>
            <p className="mu">Give it a title and genre.</p>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" aria-label="Title" />
            <div className="modal-error" role="alert">{error}</div>
            <select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Genre">
              {['Fantasy', 'Sci-fi', 'Noir', 'Horror'].map((option) => <option key={option}>{option}</option>)}
            </select>
            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button type="button" className="btn g" onClick={() => { setDialogOpen(false); setError(''); }}>Cancel</button>
              <button type="submit" className="btn">Create comic</button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
