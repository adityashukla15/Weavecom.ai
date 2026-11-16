import { useMemo, useState } from 'react';
import CharacterArt from '../components/common/CharacterArt.jsx';
import { creators } from '../data/demoData.js';
import { useToast } from '../context/ToastContext.jsx';

const genres = ['All', 'Fantasy', 'Sci-fi', 'Noir', 'Horror'];
const titles = ['Ember Court', 'Static Saints', 'Last Lantern', 'Paper Moons', 'Kaiju Tax', 'Salt & Iron', 'Drift', 'Velvet Cage', 'Wren Road'];
const comicGenres = ['Fantasy', 'Sci-fi', 'Noir', 'Horror'];

export default function Community() {
  const [genre, setGenre] = useState('All');
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState([]);
  const toast = useToast();
  const comics = useMemo(
    () => titles.map((title, index) => ({
      title,
      creator: creators[index % creators.length],
      genre: comicGenres[index % comicGenres.length],
      likes: 120 + index * 37,
    })),
    [],
  );
  const filtered = comics.filter((comic) => (
    (genre === 'All' || comic.genre === genre)
    && comic.title.toLowerCase().includes(query.toLowerCase())
  ));

  function followCreator(title) {
    if (following.includes(title)) return;
    setFollowing((current) => [...current, title]);
    toast('Following creator');
  }

  return (
    <>
      <h1>Community</h1>
      <div className="row community-filters" style={{ margin: '14px 0' }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search comics"
          style={{ maxWidth: 260 }}
          aria-label="Search comics"
        />
        {genres.map((item) => (
          <button
            className={`btn sm ${item === genre ? '' : 'g'}`}
            onClick={() => setGenre(item)}
            aria-pressed={item === genre}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="grid">
        {filtered.length ? filtered.map((comic, index) => (
          <div className="card" key={comic.title}>
            <CharacterArt index={index} label={comic.genre} />
            <b style={{ display: 'block', marginTop: 8 }}>{comic.title}</b>
            <span className="mu">by {comic.creator[0]} · ♥ {comic.likes}</span>
            <div>
              <button
                className="btn g sm"
                style={{ marginTop: 6 }}
                aria-pressed={following.includes(comic.title)}
                onClick={() => followCreator(comic.title)}
              >
                {following.includes(comic.title) ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        )) : (
          <div className="mu">No comics match. Clear the search or pick another genre.</div>
        )}
      </div>
    </>
  );
}
