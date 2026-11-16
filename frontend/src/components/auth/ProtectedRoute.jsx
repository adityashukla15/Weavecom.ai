import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function AuthStatus({ message, error, onRetry }) {
  return (
    <main className="auth-page">
      <section className="card auth-card" role={error ? 'alert' : 'status'}>
        <h1>{error ? 'Account verification unavailable' : 'Restoring your session'}</h1>
        <p className="mu">{message}</p>
        {error && <button className="btn" type="button" onClick={onRetry}>Try again</button>}
      </section>
    </main>
  );
}

export function RequireAuth() {
  const { status, authError, retryProfile } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <AuthStatus message="Please wait while we verify your account." />;
  }
  if (status === 'error') {
    return <AuthStatus message={authError} error onRetry={retryProfile} />;
  }
  if (status === 'unconfigured') {
    return <AuthStatus message="Authentication is not configured for this deployment." error />;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
