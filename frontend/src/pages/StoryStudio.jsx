import { useState } from 'react';
import { storyText } from '../data/demoData.js';
import { useToast } from '../context/ToastContext.jsx';

const chapters = ['1 · The Oath', '2 · Ashfall', '3 · The Tower'];

export default function StoryStudio() {
  const [genre, setGenre] = useState('Fantasy');
  const [story, setStory] = useState(storyText);
  const [findings, setFindings] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const toast = useToast();
  const wordCount = story.split(/\s+/).filter(Boolean).length;

  async function analyzeStory() {
    setAnalyzing(true);
    setFindings([]);
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    const results = [];
    if (/burned the bridge/i.test(story) && /crossed it/i.test(story)) {
      results.push(['bad', 'Timeline conflict', 'The bridge was burned three days earlier but Kaito crosses it. Add a ford or another route.']);
    }
    if (/still wounded/i.test(story)) {
      results.push(['wa', 'Continuity', 'Hana’s wound is not mentioned in chapter 2. Confirm where she was hurt.']);
    }
    if (/cheerfully mocked/i.test(story)) {
      results.push(['wa', 'Character behaviour', 'Kaito is written as stoic elsewhere. Cheerful mockery may read as out of character.']);
    }
    results.push(['ok', 'Pacing suggestion', 'Open with a short beat of silence before the first line of dialogue.']);
    setFindings(results);
    setAnalyzing(false);
    toast('Analysis finished (demo)');
  }

  return (
    <>
      <h1>Story Studio</h1>
      <div className="cols" style={{ marginTop: 14 }}>
        <div className="card">
          <b>Chapters</b>
          {chapters.map((item, index) => (
            <div
              style={{ padding: 7, borderRadius: 6, ...(index === 2 ? { background: 'var(--card2)' } : {}) }}
              key={item}
            >
              {item}
            </div>
          ))}
          <hr style={{ borderColor: 'var(--ln)' }} />
          <b>Characters</b>
          <div className="mu">Kaito · Hana Mirei · Nox</div>
        </div>
        <div className="card">
          <div className="row sp" style={{ marginBottom: 8 }}>
            <select value={genre} onChange={(event) => setGenre(event.target.value)} style={{ width: 'auto' }} aria-label="Genre">
              <option>Fantasy</option>
              <option>Noir</option>
            </select>
            <span className="mu">{wordCount} words</span>
          </div>
          <textarea aria-label="Story editor" value={story} onChange={(event) => setStory(event.target.value)} />
        </div>
        <div className="card ai">
          <b>Story intelligence</b>
          <p className="mu" style={{ fontSize: 13 }}>Demo analysis: simulated findings, not a backend result.</p>
          <button className="btn sm" onClick={analyzeStory} disabled={analyzing}>
            {analyzing ? 'Analyzing…' : 'Analyze story'}
          </button>
          <div style={{ marginTop: 12 }}>
            {analyzing && <div className="scan" style={{ height: 80, borderRadius: 8, background: 'var(--bg2)' }} />}
            {findings.map(([severity, title, description]) => (
              <div style={{ marginBottom: 10 }} key={title}>
                <span className="sev" style={{ background: `var(--${severity})` }} />
                <b>{title}</b>
                <div className="mu" style={{ fontSize: 13 }}>{description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
