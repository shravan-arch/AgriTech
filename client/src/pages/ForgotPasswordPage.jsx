import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';

export const ForgotPasswordPage = () => {
  const { isAuthenticated, forgotPassword } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    try {
      await forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Unable to request password reset. Please try again.');
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
        <span className="eyebrow">{t('auth.appName')}</span>
        <h1>{t('auth.forgotPassword')}</h1>
        <p className="text-secondary">
          Enter the email associated with your account and we’ll send you a password reset link.
        </p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {submitted ? (
          <div className="auth-success-card">
            <div className="success-icon mb-3">
              <i className="bi bi-envelope-check text-success" style={{ fontSize: '2.5rem' }} aria-hidden="true" />
            </div>
            <h2 className="h5 fw-bold mb-2">{t('auth.checkEmail')}</h2>
            <p className="text-muted small mb-4">
              If an account with <strong>{email}</strong> exists, a password reset link has been dispatched. The link expires in 1 hour.
            </p>
            <Link to="/login" className="btn btn-primary w-100">
              {t('auth.signInBtn')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="form-label" htmlFor="recovery-email">{t('auth.emailLabel')}</label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <button className="btn btn-primary w-100" type="submit" disabled={submitting || !email.trim()}>
              {submitting ? (
                <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />{t('auth.submitting')}</>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>
        )}

        <p className="auth-switch">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/login">{t('auth.signInBtn')}</Link>
        </p>
      </div>
    </section>
  );
};

export default ForgotPasswordPage;
