import { useMemo, useState } from 'react';
import { characterImages } from '../assets/images.js';
import { characters, relationships } from '../data/demoData.js';

const positions = [
  [50, 50], [78, 22], [22, 25], [82, 62], [24, 68],
  [56, 86], [5, 45], [8, 82], [76, 88], [94, 40],
];

export default function UniverseExplorer() {
  const [selected, setSelected] = useState(0);
  const [threshold, setThreshold] = useState(3);
  const [showLabels, setShowLabels] = useState(true);
  const [checking, setChecking] = useState(false);
  const [conflict, setConflict] = useState('');
  const connections = useMemo(
    () => relationships.filter((relationship) => relationship[3] >= threshold),
    [threshold],
  );
  const character = characters[selected];

  async function runCanonCheck() {
    setChecking(true);
    setConflict('');
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setConflict('⚠ Nox hunts Vesper, yet both link to Seraphine. Review canon before publishing.');
    setChecking(false);
  }

  return (
    <>
      <div className="row sp">
        <h1>Universe Explorer</h1>
        <span className="mu">{connections.length} connections shown</span>
      </div>
      <div className="uni">
        <div className="card gr" aria-label="Interactive universe relationship map">
          <svg aria-hidden="true">
            {connections.map(([from, to, label], index) => {
              const isSelected = from === selected || to === selected;
              return (
                <line
                  key={`${from}-${to}-${index}`}
                  x1={`${positions[from][0]}%`}
                  y1={`${positions[from][1]}%`}
                  x2={`${positions[to][0]}%`}
                  y2={`${positions[to][1]}%`}
                  stroke={isSelected ? '#C084FC' : '#9B6DFF'}
                  strokeOpacity={isSelected ? 1 : 0.45}
                  strokeWidth={isSelected ? 2.6 : 1.2}
                  data-label={label}
                />
              );
            })}
          </svg>
          {showLabels && connections.map(([from, to, label], index) => (
            <span
              className="el"
              style={{
                left: `${(positions[from][0] + positions[to][0]) / 2}%`,
                top: `${(positions[from][1] + positions[to][1]) / 2}%`,
              }}
              key={`label-${from}-${to}-${index}`}
            >
              {label}
            </span>
          ))}
          {characters.map((item, index) => (
            <button
              className={`av ${index === selected ? 'on' : ''}`}
              data-n={index}
              style={{ left: `${positions[index][0]}%`, top: `${positions[index][1]}%` }}
              title={item.n}
              aria-label={item.n}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
              key={item.n}
            >
              <img src={characterImages[index]} alt="" />
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div className="card">
            <div className="row">
              <img
                src={characterImages[selected]}
                style={{ width: 56, height: 70, objectFit: 'cover', objectPosition: '50% 15%', borderRadius: 8 }}
                alt=""
              />
              <div>
                <b>{character.n}</b>
                <div className="mu">{character.role}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {relationships
                .filter(([from, to]) => from === selected || to === selected)
                .map(([from, to, label], index) => (
                  <div className="mu" key={`${from}-${to}-${index}`}>
                    {characters[from === selected ? to : from].n}: {label}
                  </div>
                ))}
            </div>
          </div>

          <div className="card">
            <b>Interactive Universe Map</b>
            <label className="row sp" style={{ marginTop: 8 }}>
              <span>Min. strength <b>{threshold}</b></span>
              <input
                type="range"
                min="1"
                max="9"
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                style={{ width: '50%' }}
                aria-label="Minimum relationship strength"
              />
            </label>
            <label className="row" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(event) => setShowLabels(event.target.checked)}
                style={{ width: 'auto' }}
              />
              Show labels
            </label>
          </div>

          <div className="card ai">
            <b>Canon Conflict Check</b>
            <p className="mu" style={{ fontSize: 13 }}>Demo heuristic over the relationship data.</p>
            <button className="btn sm" onClick={runCanonCheck} disabled={checking}>
              {checking ? 'Checking…' : 'Run check'}
            </button>
            <div style={{ marginTop: 8 }} className={conflict ? 'canon-conflict' : ''}>
              {checking && <div className="scan" style={{ height: 36 }} />}
              {conflict}
            </div>
          </div>

          <div className="card">
            <b>World Lore &amp; Timelines</b>
            <div className="flow">
              {['The Great Rift', 'Crossover', 'Sky Citadel'].map((lore) => <div key={lore}>{lore}</div>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
