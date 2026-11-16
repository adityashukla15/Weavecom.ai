import { Link } from 'react-router-dom';
import { landingImages } from '../assets/images.js';

const steps = ['Idea', 'Story', 'Characters', 'AI Storyboard', 'Comic Panels', 'Editing', 'Publishing'];

export default function LandingPage() {
  return (
    <div id="pvhome">
      <header>
        <div className="pv-wrap">
          <div className="pv-bar">
            <Link className="pv-logo" to="/">
              <i>✸</i>PANELVERSE <b>AI</b>
            </Link>
            <div className="pv-links">
              <Link to="/universe">Explore Universe</Link>
              <a href="#pv-features">Features</a>
              <Link to="/community">Community</Link>
            </div>
            <Link className="pv-btn pv-pri" to="/comic">Start Creating</Link>
          </div>
        </div>
      </header>

      <div className="pv-main" id="pv-home">
        <div className="pv-wrap pv-hero">
          <div>
            <h1 className="pv-grad">EVERY UNIVERSE BEGINS WITH A <span className="pv-hl">STORY.</span></h1>
            <p className="pv-lead">Create stories, build unforgettable characters and transform your imagination into cinematic comics with AI.</p>
            <div className="pv-cta">
              <Link className="pv-btn pv-pri" to="/comic">Start Creating</Link>
              <Link className="pv-btn" to="/universe">Explore the Universe</Link>
            </div>
          </div>
          <div className="pv-stage">
            <img className="pv-art" src={landingImages[0]} alt="Anime comic characters and panels" />
          </div>
        </div>

        <div className="pv-wrap pv-feat" id="pv-features">
          <div className="pv-glass">Story Intelligence<i>✎</i></div>
          <div className="pv-glass">AI Comic Editor<i>▦</i></div>
        </div>

        <section id="pv-studio">
          <div className="pv-wrap pv-studio">
            <div>
              <div className="pv-kick">AI COMIC STUDIO</div>
              <h2 className="pv-grad">CRAFT YOUR WORLD, PANEL BY PANEL.</h2>
              <p className="pv-sub">Layout suggestions, character recognition and dialogue tools to bring your story to life.</p>
              <div className="pv-cta">
                <Link className="pv-btn pv-pri" to="/comic">Open Comic Editor</Link>
                <Link className="pv-btn" to="/comic">See Studio Features</Link>
              </div>
            </div>
            <div className="pv-coll">
              <img className="pv-t1" src={landingImages[1]} alt="" />
              <img className="pv-t2" src={landingImages[2]} alt="" />
              <img className="pv-t3" src={landingImages[3]} alt="" />
              {[4, 5, 6, 7].map((image) => <img className="pv-b" src={landingImages[image]} alt="" key={image} />)}
              <div className="pv-glass pv-cA">
                <h4>Panel Layout Recommender</h4>
                <div className="pv-lay">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
                <span className="pv-chk">AI Suggest: 3 panels</span>
              </div>
              <div className="pv-glass pv-cB">
                <h4>Character Recognition</h4>
                <div className="pv-av2">
                  {[8, 9, 10, 11].map((image) => <img src={landingImages[image]} alt="" key={image} />)}
                </div>
                <span className="pv-chk">✓ Consistent style match</span>
              </div>
              <div className="pv-glass pv-cC">
                <h4>AI Speech &amp; Dialogue</h4>
                <span className="pv-pill pv-on">Whisper</span>
                <span className="pv-pill">Thought Bubble</span>
                <span className="pv-pill">Special Emphasis</span>
              </div>
            </div>
          </div>
        </section>

        <section id="pv-universe">
          <div className="pv-wrap pv-uni">
            <div className="pv-map pv-glass" aria-hidden="true">
              <svg viewBox="0 0 600 400" preserveAspectRatio="none">
                <g stroke="#8b5cf6" strokeOpacity=".7" strokeWidth="1.5" fill="none">
                  <line x1="300" y1="190" x2="470" y2="90" />
                  <line x1="300" y1="190" x2="480" y2="235" />
                  <line x1="300" y1="190" x2="215" y2="330" />
                </g>
              </svg>
              <img className="pv-av" style={{ left: '50%', top: '47%', width: 108 }} src={landingImages[8]} alt="" />
              <img className="pv-av" style={{ left: '78%', top: '22%', width: 84 }} src={landingImages[9]} alt="" />
              <img className="pv-av" style={{ left: '80%', top: '58%', width: 84 }} src={landingImages[10]} alt="" />
              <img className="pv-av" style={{ left: '36%', top: '82%', width: 84 }} src={landingImages[11]} alt="" />
              <div className="pv-glass pv-chk1">
                <h4>Canon Conflict Check</h4>
                <p>✓ No inconsistencies detected</p>
                <p>✓ Crossover validation passed</p>
              </div>
              <div className="pv-glass pv-chk2">
                <h4>World Lore &amp; Timelines</h4>
                <span className="pv-pill pv-on">The Great Rift</span>
                <span className="pv-pill">Crossover</span>
              </div>
            </div>
            <div>
              <div className="pv-kick">STORY UNIVERSE ENGINE</div>
              <h2 className="pv-grad">MAP YOUR ENTIRE FICTIONAL UNIVERSE.</h2>
              <p className="pv-sub">Connect characters, world rules, timelines and crossover storylines in an interactive visual universe.</p>
              <div className="pv-cta">
                <Link className="pv-btn pv-pri" to="/universe">Explore Universe</Link>
                <Link className="pv-btn" to="/universe">View Timeline</Link>
              </div>
            </div>
          </div>
        </section>

        <section id="pv-timeline" style={{ paddingTop: 20 }}>
          <div className="pv-wrap">
            <h3 className="pv-grad" style={{ fontSize: 34, marginBottom: 26 }}>IDEA TO PUBLISHED COMIC</h3>
            <div className="pv-tl">{steps.map((step) => <div key={step}><i>✸</i>{step}</div>)}</div>
          </div>
        </section>

        <div className="pv-wrap" id="pv-join">
          <div className="pv-glass pv-cta-box">
            <h2 className="pv-grad">YOUR STORY DESERVES ITS OWN UNIVERSE.</h2>
            <Link className="pv-btn pv-pri" to="/comic">Create Your First Comic</Link>
          </div>
        </div>
      </div>
      <div className="pv-wrap"><footer><span>© 2026 PanelVerse AI</span></footer></div>
    </div>
  );
}
