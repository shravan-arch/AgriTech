import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';

export const ResetPasswordPage = () => {
  const { isAuthenticated, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const routeParams = useParams();

  const token = searchParams.get('token') || routeParams.token || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Password reset token is missing. Please request a new reset link.');
      return;
    }

    if (password.length < 10) {
      setError('Password must contain at least 10 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please ensure both passwords are identical.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired or already been used.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-layout">
      <div className="auth-panel">
        <Link className="brand-mark auth-brand" to="/" aria-label="AgriTech home">
          <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
          <span>Agri<span className="brand-accent">Tech</span></span>
        </Link>
        <span className="eyebrow">Account recovery</span>
        <h1>Choose new password</h1>
        <p className="text-secondary">
          Set a new, secure password for your AgriTech farm account.
        </p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {!token && (
          <div className="alert alert-warning" role="alert">
            <p className="mb-2"><strong>Reset link is invalid or incomplete.</strong></p>
            <p className="small mb-0">No reset token was found in this URL. Please request a new password reset link.</p>
            <div className="mt-3">
              <Link to="/forgot-password" className="btn btn-sm btn-outline-dark">
                Request new link
              </Link>
            </div>
          </div>
        )}

        {success ? (
          <div className="auth-success-card">
            <div className="success-icon mb-3">
              <i className="bi bi-shield-check text-success" style={{ fontSize: '2.5rem' }} aria-hidden="true" />
            </div>
            <h2 className="h5 fw-bold mb-2">Password reset complete</h2>
            <p className="text-muted small mb-4">
              Your password has been securely updated and previous sessions have been invalidated. You can now sign in with your new password.
            </p>
            <Link to="/login" className="btn btn-primary w-100">
              Sign in with new password
            </Link>
          </div>
        ) : (
          token && (
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  name="password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
                <div className="form-text">Must be at least 10 characters long.</div>
              </div>

              <div className="mb-4">
                <label className="form-label" htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </div>

              <button className="btn btn-primary w-100" type="submit" disabled={submitting || !password}>
                {submitting ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Updating password…</>
                ) : (
                  'Reset password'
                )}
              </button>
            </form>
          )
        )}

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </section>
  );
};

export default ResetPasswordPage;
