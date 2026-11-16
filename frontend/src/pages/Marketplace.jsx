import { useMemo, useState } from 'react';
import CharacterArt from '../components/common/CharacterArt.jsx';
import { creators, jobs } from '../data/demoData.js';
import { useToast } from '../context/ToastContext.jsx';

const roles = ['All', 'Illustrator', 'Writer', 'Editor'];

export default function Marketplace() {
  const [role, setRole] = useState('All');
  const [openOnly, setOpenOnly] = useState(false);
  const [applied, setApplied] = useState([]);
  const toast = useToast();
  const listings = useMemo(
    () => jobs.filter((job) => (role === 'All' || job[1] === role) && (!openOnly || job[3] === 'Open')),
    [role, openOnly],
  );

  function apply(title) {
    setApplied((current) => (current.includes(title) ? current : [...current, title]));
    toast('Application sent (demo)');
  }

  return (
    <>
      <h1>Marketplace</h1>
      <div className="row marketplace-filters" style={{ margin: '14px 0' }}>
        {roles.map((item) => (
          <button
            className={`btn sm ${item === role ? '' : 'g'}`}
            onClick={() => setRole(item)}
            aria-pressed={item === role}
            key={item}
          >
            {item}
          </button>
        ))}
        <label className="row">
          <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} style={{ width: 'auto' }} />
          Open only
        </label>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {listings.length ? listings.map((job) => (
          <div className="card row sp listing-card" key={job[0]}>
            <div>
              <b>{job[0]}</b>
              <div className="mu">{job[1]} · {job[4]} · {job[2]}</div>
            </div>
            <div className="row">
              <span className="tag" style={{ color: job[3] === 'Open' ? 'var(--ok)' : 'var(--wa)' }}>{job[3]}</span>
              <button className="btn sm" onClick={() => apply(job[0])} disabled={applied.includes(job[0])}>
                {applied.includes(job[0]) ? 'Applied' : 'Apply'}
              </button>
            </div>
          </div>
        )) : (
          <div className="mu">No listings match these filters.</div>
        )}
      </div>

      <h3 style={{ margin: '26px 0 10px' }}>Freelancers</h3>
      <div className="grid">
        {creators.map((creator, index) => (
          <div className="card" key={creator[0]}>
            <CharacterArt index={index} label={creator[1]} />
            <b style={{ display: 'block', marginTop: 8 }}>{creator[0]}</b>
            <span className="mu">★ {creator[2]}</span>
          </div>
        ))}
      </div>
    </>
  );
}
