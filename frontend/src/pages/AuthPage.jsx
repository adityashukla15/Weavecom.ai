import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/errors.js';
import { isApiConfigured } from '../api/client.js';
import { supabaseConfigurationError } from '../api/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

function getAuthErrorMessage(error) {
  if (error instanceof TypeError || error?.name === 'AbortError') {
    return getErrorMessage(error);
  }
  if (error instanceof Error && error.message) return error.message;
  return getErrorMessage(error);
}

export default function AuthPage({ mode }) {
  const isSignUp = mode === 'signup';
  const { status, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (status === 'authenticated') {
    return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  }
  if (status === 'loading') {
    return (
      <main className="auth-page">
        <section className="card auth-card" role="status">
          <h1>Restoring your session</h1>
          <p className="mu">Please wait while we verify your account.</p>
        </section>
      </main>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (isSignUp) {
        const result = await signUp(email.trim(), password);
        if (!result.session) {
          setMessage('Check your email to confirm your account, then sign in.');
          return;
        }
        navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
      } else {
        await signIn(email.trim(), password);
        navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
      }
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <Link className="logo auth-logo" to="/">PANELVERSE <i>AI</i></Link>
        <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mu">
          {isSignUp
            ? 'Create an account to continue to PanelVerse AI.'
            : 'Sign in to continue to PanelVerse AI.'}
        </p>
        {(supabaseConfigurationError || !isApiConfigured) && (
          <p className="auth-error" role="alert">
            {supabaseConfigurationError || 'The backend API is not configured. Set VITE_API_BASE_URL.'}
          </p>
        )}
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}
          <button
            className="btn auth-submit"
            type="submit"
            disabled={busy || Boolean(supabaseConfigurationError) || !isApiConfigured}
          >
            {busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="mu auth-switch">
          {isSignUp ? 'Already have an account?' : 'New to PanelVerse AI?'}{' '}
          <Link to={isSignUp ? '/login' : '/signup'}>{isSignUp ? 'Sign in' : 'Create account'}</Link>
        </p>
        <Link className="auth-home" to="/">Back to home</Link>
      </section>
    </main>
  );
}
