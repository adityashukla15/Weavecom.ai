import { useEffect, useState } from 'react';
import { assistantService } from '../api/services/assistantService.js';
import { getErrorMessage } from '../api/errors.js';

export default function ProjectAssistant() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProjects() {
      setLoadingProjects(true);
      setError('');
      try {
        const accessibleProjects = await assistantService.listProjects();
        if (active) {
          setProjects(accessibleProjects);
          setProjectId(accessibleProjects[0]?.id ?? '');
        }
      } catch (cause) {
        if (active) setError(getErrorMessage(cause));
      } finally {
        if (active) setLoadingProjects(false);
      }
    }
    void loadProjects();
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!projectId || !question.trim()) return;
    setAsking(true);
    setError('');
    setAnswer(null);
    try {
      setAnswer(await assistantService.ask(projectId, question.trim()));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="project-assistant">
      <header>
        <h1>Project Assistant</h1>
        <p className="mu">Ask questions about saved stories, characters, and completed comics you can access.</p>
      </header>

      {error && <p className="auth-error" role="alert">{error}</p>}
      {loadingProjects ? (
        <div className="card mu" role="status">Loading accessible projects…</div>
      ) : projects.length === 0 ? (
        <div className="card assistant-empty">
          <h2>No accessible projects</h2>
          <p className="mu">Projects available to your account will appear here.</p>
        </div>
      ) : (
        <>
          <form className="card assistant-question" onSubmit={submit}>
            <label htmlFor="assistant-project">Project</label>
            <select id="assistant-project" value={projectId} onChange={(event) => {
              setProjectId(event.target.value);
              setAnswer(null);
            }}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
            <label htmlFor="assistant-question">Question</label>
            <textarea
              id="assistant-question"
              rows="4"
              maxLength={2000}
              required
              minLength={3}
              placeholder="For example: What motivates the protagonist?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button className="btn" type="submit" disabled={asking || !question.trim()}>
              {asking ? 'Searching project knowledge…' : 'Ask'}
            </button>
          </form>

          {asking && <div className="card mu" role="status">Retrieving project records and preparing an answer…</div>}
          {answer && (
            <section className="card assistant-answer" aria-live="polite">
              <h2>Answer</h2>
              <p>{answer.answer}</p>
              <h3>Sources</h3>
              {answer.sources.length ? (
                <ul>
                  {answer.sources.map((source) => (
                    <li key={`${source.content_type}-${source.id}`}>
                      <span className="tag">{source.content_type}</span> {source.title}
                    </li>
                  ))}
                </ul>
              ) : <p className="mu">No relevant saved sources were found.</p>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
