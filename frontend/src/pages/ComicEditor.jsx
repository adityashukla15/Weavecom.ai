import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../api/errors.js';
import { comicService } from '../api/services/comicService.js';
import { storyService } from '../api/services/storyService.js';
import { useToast } from '../context/ToastContext.jsx';

const blankComic = { story_id: '', title: '', description: '', status: 'draft' };
const blankPanel = { description: '', image_url: '', layout: { width: 3, height: 2, background: '#f4f1ea' } };
const blankBubble = { text: '', bubble_type: 'speech', position_x: 50, position_y: 22 };

function PanelEditor({ panel, comicId, onRefresh, onPanelAction, setError }) {
  const [values, setValues] = useState({
    description: panel.description,
    image_url: panel.image_url ?? '',
    layout: {
      width: Number(panel.layout?.width) || 3,
      height: Number(panel.layout?.height) || 2,
      background: panel.layout?.background || '#f4f1ea',
    },
  });
  const [bubble, setBubble] = useState(blankBubble);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValues({
      description: panel.description,
      image_url: panel.image_url ?? '',
      layout: {
        width: Number(panel.layout?.width) || 3,
        height: Number(panel.layout?.height) || 2,
        background: panel.layout?.background || '#f4f1ea',
      },
    });
  }, [panel]);

  async function savePanel(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await comicService.updatePanel(comicId, panel.id, {
        description: values.description,
        image_url: values.image_url.trim() || null,
        layout: values.layout,
      });
      await onRefresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function addBubble(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await comicService.createBubble(comicId, panel.id, bubble);
      setBubble(blankBubble);
      await onRefresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateBubble(id, changes) {
    setBusy(true);
    setError('');
    try {
      await comicService.updateBubble(comicId, panel.id, id, changes);
      await onRefresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteBubble(id) {
    if (!window.confirm('Delete this dialogue bubble?')) return;
    setBusy(true);
    setError('');
    try {
      await comicService.deleteBubble(comicId, panel.id, id);
      await onRefresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card comic-panel-editor">
      <div className="row sp">
        <h3>Panel {panel.panel_number}</h3>
        <div className="row">
          <button className="btn g sm" type="button" onClick={() => onPanelAction('up', panel.id)} disabled={busy || panel.panel_number === 1}>↑</button>
          <button className="btn g sm" type="button" onClick={() => onPanelAction('down', panel.id)} disabled={busy}>↓</button>
          <button className="btn g sm" type="button" onClick={() => onPanelAction('delete', panel.id)} disabled={busy}>Delete panel</button>
        </div>
      </div>
      <form className="comic-panel-form" onSubmit={savePanel}>
        <label>
          Panel description
          <textarea rows="3" maxLength={2000} value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the action and setting in this panel." />
        </label>
        <label>
          Image URL (optional)
          <input type="url" value={values.image_url} onChange={(event) => setValues((current) => ({ ...current, image_url: event.target.value }))} placeholder="https://…" />
        </label>
        <div className="row comic-panel-layout">
          <label>Width units
            <input type="number" min="1" max="6" value={values.layout.width} onChange={(event) => setValues((current) => ({ ...current, layout: { ...current.layout, width: Number(event.target.value) } }))} />
          </label>
          <label>Height units
            <input type="number" min="1" max="6" value={values.layout.height} onChange={(event) => setValues((current) => ({ ...current, layout: { ...current.layout, height: Number(event.target.value) } }))} />
          </label>
          <label>Panel color
            <input type="color" value={values.layout.background} onChange={(event) => setValues((current) => ({ ...current, layout: { ...current.layout, background: event.target.value } }))} />
          </label>
        </div>
        <button className="btn g sm" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save panel'}</button>
      </form>

      <div className="comic-bubble-list">
        <b>Dialogue</b>
        {panel.bubbles.map((item) => (
          <BubbleEditor
            key={item.id}
            bubble={item}
            busy={busy}
            onSave={(changes) => updateBubble(item.id, changes)}
            onDelete={() => deleteBubble(item.id)}
          />
        ))}
        <form className="comic-bubble-form" onSubmit={addBubble}>
          <textarea rows="2" maxLength={2000} required placeholder="Dialogue or narration…" value={bubble.text} onChange={(event) => setBubble((current) => ({ ...current, text: event.target.value }))} />
          <div className="row">
            <select aria-label="New bubble type" value={bubble.bubble_type} onChange={(event) => setBubble((current) => ({ ...current, bubble_type: event.target.value }))}>
              <option value="speech">Speech</option>
              <option value="thought">Thought</option>
              <option value="narration">Narration</option>
            </select>
            <button className="btn g sm" type="submit" disabled={busy}>Add dialogue</button>
          </div>
        </form>
      </div>
    </article>
  );
}

function BubbleEditor({ bubble, busy, onSave, onDelete }) {
  const [text, setText] = useState(bubble.text);
  const [type, setType] = useState(bubble.bubble_type);
  const [x, setX] = useState(bubble.position_x);
  const [y, setY] = useState(bubble.position_y);
  useEffect(() => {
    setText(bubble.text);
    setType(bubble.bubble_type);
    setX(bubble.position_x);
    setY(bubble.position_y);
  }, [bubble]);
  return (
    <div className="comic-bubble-edit">
      <textarea rows="2" maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} aria-label="Edit dialogue" />
      <div className="row">
        <select aria-label="Bubble type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="speech">Speech</option>
          <option value="thought">Thought</option>
          <option value="narration">Narration</option>
        </select>
        <label className="comic-position">X % <input type="number" min="0" max="100" value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
        <label className="comic-position">Y % <input type="number" min="0" max="100" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
      </div>
      <div className="row">
        <button className="btn g sm" type="button" disabled={busy} onClick={() => onSave({ text, bubble_type: type, position_x: x, position_y: y })}>Save dialogue</button>
        <button className="btn g sm" type="button" disabled={busy} onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function ComicPreview({ comic }) {
  return (
    <section className="comic-preview-page" aria-label="Comic page preview">
      {comic.panels.map((panel) => (
        <article
          className="comic-preview-panel"
          key={panel.id}
          style={{
            gridColumn: `span ${Math.min(6, Math.max(1, Number(panel.layout?.width) || 3))}`,
            minHeight: `${Math.min(6, Math.max(1, Number(panel.layout?.height) || 2)) * 65}px`,
            backgroundColor: panel.layout?.background || '#f4f1ea',
          }}
        >
          {panel.image_url && <img src={panel.image_url} alt="" />}
          <span className="comic-preview-number">{panel.panel_number}</span>
          {panel.description && <p className="comic-preview-description">{panel.description}</p>}
          {panel.bubbles.map((bubble) => (
            <div
              className={`comic-preview-bubble ${bubble.bubble_type}`}
              key={bubble.id}
              style={{ left: `${bubble.position_x}%`, top: `${bubble.position_y}%` }}
            >
              {bubble.text}
            </div>
          ))}
        </article>
      ))}
      {!comic.panels.length && <div className="mu comic-preview-empty">Add a panel to preview your page.</div>}
    </section>
  );
}

export default function ComicEditor() {
  const [stories, setStories] = useState([]);
  const [comics, setComics] = useState([]);
  const [comic, setComic] = useState(null);
  const [creation, setCreation] = useState(blankComic);
  const [editingMeta, setEditingMeta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const selectedComicId = comic?.id;
  const currentStory = useMemo(
    () => stories.find((story) => story.id === comic?.story_id),
    [stories, comic?.story_id],
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [storyRows, comicRows] = await Promise.all([storyService.list(), comicService.list()]);
      setStories(storyRows);
      setComics(comicRows);
      const currentId = selectedComicId && comicRows.some((row) => row.id === selectedComicId)
        ? selectedComicId
        : comicRows[0]?.id;
      const detail = currentId ? await comicService.get(currentId) : null;
      setComic(detail);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [selectedComicId]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [storyRows, comicRows] = await Promise.all([storyService.list(), comicService.list()]);
        const currentId = selectedComicId && comicRows.some((row) => row.id === selectedComicId)
          ? selectedComicId
          : comicRows[0]?.id;
        const detail = currentId ? await comicService.get(currentId) : null;
        if (active) {
          setStories(storyRows);
          setComics(comicRows);
          setComic(detail);
        }
      } catch (cause) {
        if (active) setError(getErrorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [selectedComicId]);

  async function refreshComic(id = comic?.id) {
    if (!id) return;
    const [detail, rows] = await Promise.all([comicService.get(id), comicService.list()]);
    setComic(detail);
    setComics(rows);
  }

  async function createComic(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await comicService.create(creation);
      setCreation(blankComic);
      await refreshComic(created.id);
      toast('Comic created');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveComic(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await comicService.update(comic.id, {
        title: comic.title,
        description: comic.description,
        status: comic.status,
      });
      await refreshComic();
      setEditingMeta(false);
      toast('Comic saved');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function addPanel() {
    setBusy(true);
    setError('');
    try {
      await comicService.createPanel(comic.id, blankPanel);
      await refreshComic();
      toast('Panel added');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function changePanels(action, panelId) {
    setError('');
    try {
      if (action === 'delete') {
        if (!window.confirm('Delete this panel and all its dialogue?')) return;
        await comicService.deletePanel(comic.id, panelId);
      } else {
        const ordered = [...comic.panels].sort((a, b) => a.panel_number - b.panel_number);
        const index = ordered.findIndex((panel) => panel.id === panelId);
        const target = action === 'up' ? index - 1 : index + 1;
        if (index < 0 || target < 0 || target >= ordered.length) return;
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        await comicService.reorderPanels(comic.id, ordered.map((panel) => panel.id));
      }
      await refreshComic();
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  async function deleteComic() {
    if (!comic || !window.confirm(`Delete "${comic.title}" and all its panels/dialogue?`)) return;
    setBusy(true);
    setError('');
    try {
      await comicService.remove(comic.id);
      setComic(null);
      setComics((current) => current.filter((row) => row.id !== comic.id));
      toast('Comic deleted');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="comic-editor-page">
      <div className="row sp comic-toolbar">
        <div>
          <h1>Comic Editor</h1>
          <span className="mu">Build a page from your saved stories, panels, and dialogue.</span>
        </div>
        {comic && <button className="btn g sm" type="button" onClick={deleteComic} disabled={busy}>Delete comic</button>}
      </div>
      {error && <p className="auth-error" role="alert">{error} <button type="button" className="btn g sm" onClick={loadWorkspace}>Retry</button></p>}
      {loading ? (
        <div className="card mu" role="status">Loading comics…</div>
      ) : (
        <>
          <div className="comic-workspace">
            <aside className="card comic-library">
              <b>Your comics</b>
              {comics.map((row) => (
                <button
                  type="button"
                  className={`comic-library-item${comic?.id === row.id ? ' selected' : ''}`}
                  key={row.id}
                  onClick={async () => {
                    setError('');
                    try { setComic(await comicService.get(row.id)); } catch (cause) { setError(getErrorMessage(cause)); }
                  }}
                >
                  <strong>{row.title}</strong>
                  <span className="mu">{row.story_title} · {row.status}</span>
                </button>
              ))}
              {!comics.length && <p className="mu">Create a comic from a saved story.</p>}
              <form className="comic-create-form" onSubmit={createComic}>
                <b>New comic</b>
                <label>Story
                  <select required value={creation.story_id} onChange={(event) => {
                    const selected = stories.find((story) => story.id === event.target.value);
                    setCreation((current) => ({
                      ...current,
                      story_id: event.target.value,
                      title: current.title || selected?.title || '',
                    }));
                  }}>
                    <option value="">Select a story</option>
                    {stories.map((story) => <option value={story.id} key={story.id}>{story.title}</option>)}
                  </select>
                </label>
                <label>Title
                  <input required maxLength={160} value={creation.title} onChange={(event) => setCreation((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>Description
                  <textarea rows="2" maxLength={1000} value={creation.description} onChange={(event) => setCreation((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <button className="btn sm" type="submit" disabled={busy || !stories.length}>Create comic</button>
                {!stories.length && <span className="mu">Create a story first in Story Studio.</span>}
              </form>
            </aside>
            {comic ? (
              <main className="comic-main">
                <section className="card comic-details">
                  {editingMeta ? (
                    <form className="comic-meta-form" onSubmit={saveComic}>
                      <label>Comic title
                        <input required maxLength={160} value={comic.title} onChange={(event) => setComic((current) => ({ ...current, title: event.target.value }))} />
                      </label>
                      <label>Description
                        <textarea rows="2" maxLength={1000} value={comic.description} onChange={(event) => setComic((current) => ({ ...current, description: event.target.value }))} />
                      </label>
                      <label>Status
                        <select value={comic.status} onChange={(event) => setComic((current) => ({ ...current, status: event.target.value }))}>
                          <option value="draft">Draft</option>
                          <option value="completed">Completed</option>
                        </select>
                      </label>
                      <div className="row">
                        <button className="btn sm" type="submit" disabled={busy}>Save comic</button>
                        <button className="btn g sm" type="button" onClick={() => { setEditingMeta(false); void refreshComic(); }}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="row sp">
                      <div>
                        <span className="tag">{comic.status}</span>
                        <h2>{comic.title}</h2>
                        <p className="mu">{comic.description || 'No description'}{currentStory ? ` · Story: ${currentStory.title}` : ''}</p>
                      </div>
                      <button className="btn g sm" type="button" onClick={() => setEditingMeta(true)}>Edit details</button>
                    </div>
                  )}
                </section>
                <div className="row sp comic-panels-heading">
                  <h2>Panels</h2>
                  <button className="btn sm" type="button" onClick={addPanel} disabled={busy}>Add panel</button>
                </div>
                {!comic.panels.length && <div className="card mu">No panels yet. Add a panel to begin your page.</div>}
                <div className="comic-panel-stack">
                  {[...comic.panels].sort((a, b) => a.panel_number - b.panel_number).map((panel) => (
                    <PanelEditor
                      key={panel.id}
                      panel={panel}
                      comicId={comic.id}
                      onRefresh={() => refreshComic()}
                      onPanelAction={changePanels}
                      setError={setError}
                    />
                  ))}
                </div>
              </main>
            ) : (
              <section className="card comic-main comic-empty">
                <h2>No comic selected</h2>
                <p className="mu">Choose a saved comic or create one from a story.</p>
              </section>
            )}
            {comic && <aside className="comic-preview-column">
              <div className="row sp"><b>Page preview</b><span className="mu">{comic.panels.length} panels</span></div>
              <ComicPreview comic={comic} />
            </aside>}
          </div>
        </>
      )}
    </div>
  );
}
