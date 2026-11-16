import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function AccessPendingPage() {
  const { status, signOut } = useAuth();
  const [error, setError] = useState('');
  if (status !== 'authenticated') return <Navigate to="/login" replace />;

  async function handleSignOut() {
    setError('');
    try {
      await signOut();
    } catch {
      setError('You were signed out locally, but the server could not end the remote session.');
    }
  }

  return (
    <main className="auth-page">
      <section className="card auth-card" role="status">
        <h1>Access is pending</h1>
        <p className="mu">
          Your account is signed in, but it does not have a trusted Writer or Reader role yet.
          Contact a PanelVerse administrator to assign your role.
        </p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="btn" type="button" onClick={handleSignOut}>Sign out</button>
        <p><Link to="/">Return to home</Link></p>
      </section>
    </main>
  );
}

export function ForbiddenPage() {
  return (
    <main className="auth-page">
      <section className="card auth-card" role="alert">
        <h1>Not available for this role</h1>
        <p className="mu">Readers can browse published community content. This area is reserved for Writers.</p>
        <Link to="/community">Browse community</Link>
      </section>
    </main>
  );
}
