import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const navigation = [
  ['dashboard', 'Dashboard', 'grid'],
  ['story', 'Story Studio', 'pen'],
  ['universe', 'Universe Explorer', 'globe'],
  ['comic', 'Comic Editor', 'panel'],
  ['community', 'Community', 'user'],
  ['marketplace', 'Marketplace', 'tag'],
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const toast = useToast();
  const isHome = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('inapp', !isHome);
    document.body.classList.toggle('pvhome', isHome);
    document.documentElement.classList.toggle('pvhome', isHome);
    window.scrollTo(0, 0);

    return () => {
      document.body.classList.remove('inapp', 'pvhome');
      document.documentElement.classList.remove('pvhome');
    };
  }, [isHome, pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {!isHome && (
        <nav className={`side${menuOpen ? ' menu-open' : ''}`} aria-label="Main navigation">
          <div className="mobile-nav-header">
            <Link to="/" className="logo">
              <Icon name="burst" size={22} fill="var(--p)" /> PANELVERSE <i>AI</i>
            </Link>
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
          <div className="mobile-nav-links" id="primary-navigation">
            {navigation.map(([path, label, icon]) => (
              <NavLink key={path} to={`/${path}`} className={({ isActive }) => (isActive ? 'on' : '')}>
                <Icon name={icon} size={17} /> {label}
              </NavLink>
            ))}
            {['Assets', 'Settings'].map((label) => (
              <button className="sl" key={label} onClick={() => toast(`${label} is not built in this demo`)}>
                <Icon name="burst" size={17} /> {label}
              </button>
            ))}
          </div>
        </nav>
      )}
      <main id="app" key={pathname} className={isHome ? '' : 'turn'}>
        <Outlet />
      </main>
    </>
  );
}
