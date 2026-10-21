import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';

const AuthPage = ({ mode }) => {
  const isRegister = mode === 'register';
  const { isAuthenticated, loading, authError, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  if (loading) {
    return (
      <section className="auth-layout">
        <div className="loading-panel" role="status" aria-live="polite">
          <span className="spinner-border text-success" aria-hidden="true" />
          <span>Checking your account…</span>
        </div>
      </section>
    );
  }

  const update = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      } else {
        await login(form.email.trim(), form.password);
      }
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
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
        <span className="eyebrow">Your farm, organized</span>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="text-secondary">
          {isRegister
            ? 'Start by setting up your farm and adding your fields.'
            : 'Sign in to manage your farms and fields.'}
        </p>

        {(error || authError) && <div className="alert alert-danger" role="alert">{error || authError}</div>}

        <form onSubmit={submit}>
          {isRegister && (
            <div className="mb-3">
              <label className="form-label" htmlFor="name">Your name</label>
              <input
                id="name"
                name="name"
                className="form-control"
                value={form.name}
                onChange={update}
                autoComplete="name"
                maxLength={50}
                required
              />
            </div>
          )}
          <div className="mb-3">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-control"
              value={form.email}
              onChange={update}
              autoComplete="email"
              required
            />
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-control"
              value={form.password}
              onChange={update}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 10 : undefined}
              maxLength={128}
              required
            />
            {isRegister && <div className="form-text">Use at least 10 characters.</div>}
          </div>
          <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
            {submitting ? (
              <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Submitting…</>
            ) : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to AgriTech?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </section>
  );
};

export default AuthPage;
