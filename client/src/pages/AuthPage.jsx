import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import LanguageToggle from '../components/LanguageToggle.jsx';

const AuthPage = ({ mode }) => {
  const isRegister = mode === 'register';
  const { isAuthenticated, loading, authError, login, googleLogin, register, resendVerification } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [selectedRole, setSelectedRole] = useState('user'); // 'user' or 'admin'
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Email verification and admin approval pending states
  const [verificationPendingEmail, setVerificationPendingEmail] = useState('');
  const [adminApprovalNotice, setAdminApprovalNotice] = useState(false);
  const [unverifiedLoginEmail, setUnverifiedLoginEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (isAuthenticated && !adminApprovalNotice) return <Navigate to="/dashboard" replace />;
  if (loading) {
    return (
      <section className="auth-layout">
        <div className="loading-panel" role="status" aria-live="polite">
          <span className="spinner-border text-success" aria-hidden="true" />
          <span>{t('common.loading')}</span>
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
    setUnverifiedLoginEmail('');
    setResendSuccess('');
    setSubmitting(true);
    try {
      if (isRegister) {
        const result = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          selectedRole,
          language,
        });

        if (result?.requiresAdminApproval) {
          setAdminApprovalNotice(true);
          return;
        }

        if (result?.requiresEmailVerification && !result?.token) {
          setVerificationPendingEmail(form.email.trim());
          setCooldown(60);
          return;
        }
      } else {
        await login(form.email.trim(), form.password);
      }
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      if (
        requestError.data?.code === 'EMAIL_NOT_VERIFIED' ||
        requestError.message?.toLowerCase().includes('verify your email')
      ) {
        setUnverifiedLoginEmail(form.email.trim());
      }
      if (requestError.data?.code === 'ACCOUNT_SUSPENDED') {
        setError(t('auth.accountSuspended'));
      } else {
        setError(requestError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (targetEmail) => {
    const emailToUse = targetEmail || verificationPendingEmail || unverifiedLoginEmail || form.email.trim();
    if (!emailToUse || resending || cooldown > 0) return;

    setResending(true);
    setError('');
    setResendSuccess('');
    try {
      const result = await resendVerification(emailToUse);
      setResendSuccess(result.message || 'Verification link resent! Check your inbox.');
      setCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend verification link.');
      if (err.data?.retryAfter) {
        setCooldown(err.data.retryAfter);
      }
    } finally {
      setResending(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    setSubmitting(true);
    try {
      await googleLogin(credential);
      navigate('/dashboard', { replace: true });
    } catch (googleError) {
      if (googleError.data?.code === 'ACCOUNT_SUSPENDED') {
        setError(t('auth.accountSuspended'));
      } else {
        setError(googleError.message || 'Google authentication failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Dedicated "Admin Request Submitted" screen
  if (adminApprovalNotice) {
    return (
      <section className="auth-layout">
        <div className="auth-panel text-center">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Link className="brand-mark auth-brand mb-0" to="/" aria-label="AgriTech home">
              <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
              <span>Agri<span className="brand-accent">Tech</span></span>
            </Link>
            <LanguageToggle />
          </div>

          <div className="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle bg-warning bg-opacity-10 text-warning p-3" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-shield-lock" style={{ fontSize: '2rem' }} aria-hidden="true" />
          </div>

          <h1 className="h3 fw-bold mb-2">{t('profile.adminPendingTitle')}</h1>
          <p className="text-secondary small mb-4">
            {t('auth.adminApprovalNotice')}
          </p>

          <div className="alert alert-info d-flex align-items-center gap-2 small mb-4 text-start" role="alert">
            <i className="bi bi-info-circle-fill flex-shrink-0" />
            <div>
              <strong>{t('profile.personalInfo')}:</strong> {form.name} ({form.email})
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary w-100 mb-3"
            onClick={() => navigate('/dashboard', { replace: true })}
          >
            {t('common.confirm')} &amp; Enter Workspace
          </button>
        </div>
      </section>
    );
  }

  // Dedicated "Check your email" pending screen
  if (verificationPendingEmail) {
    return (
      <section className="auth-layout">
        <div className="auth-panel text-center">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Link className="brand-mark auth-brand mb-0" to="/" aria-label="AgriTech home">
              <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
              <span>Agri<span className="brand-accent">Tech</span></span>
            </Link>
            <LanguageToggle />
          </div>

          <div className="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success p-3" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-envelope-check" style={{ fontSize: '2rem' }} aria-hidden="true" />
          </div>

          <h1 className="h3 fw-bold mb-2">{t('auth.checkEmail')}</h1>
          <p className="text-secondary small mb-3">
            {t('auth.checkEmailSubtext')} <strong className="text-dark">{verificationPendingEmail}</strong>.
          </p>

          {resendSuccess && (
            <div className="alert alert-success d-flex align-items-center gap-2 small mb-3" role="alert">
              <i className="bi bi-check-circle-fill flex-shrink-0" />
              <div>{resendSuccess}</div>
            </div>
          )}

          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 small mb-3" role="alert">
              <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <div className="card bg-light border-0 p-3 mb-4 text-start small">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold text-dark">Didn&apos;t get the email?</span>
              {cooldown > 0 && (
                <span className="badge bg-secondary text-white">{t('auth.cooldown')}: {cooldown}s</span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm w-100"
              onClick={() => handleResend(verificationPendingEmail)}
              disabled={resending || cooldown > 0}
            >
              {resending ? (
                <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Sending…</>
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
                  {t('auth.resendEmail')}
                </>
              )}
            </button>
          </div>

          <div className="d-flex justify-content-center gap-3 small">
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-none small"
              onClick={() => {
                setVerificationPendingEmail('');
                navigate('/login');
              }}
            >
              <i className="bi bi-arrow-left me-1" />
              {t('common.back')} to {t('auth.signInBtn')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-layout">
      <div className="auth-panel">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Link className="brand-mark auth-brand mb-0" to="/" aria-label="AgriTech home">
            <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
            <span>Agri<span className="brand-accent">Tech</span></span>
          </Link>
          <LanguageToggle />
        </div>

        <span className="eyebrow">{t('auth.tagline')}</span>
        <h1>{isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}</h1>
        <p className="text-secondary">
          {isRegister ? t('auth.startSubtext') : t('auth.loginSubtext')}
        </p>

        {unverifiedLoginEmail ? (
          <div className="alert alert-warning border-warning border-opacity-25 mb-3" role="alert">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-exclamation-triangle-fill text-warning flex-shrink-0" />
              <strong className="text-dark">Email Not Verified</strong>
            </div>
            <p className="small mb-2 text-dark">
              Please verify your email address before logging in. Check your inbox for the verification link.
            </p>
            {resendSuccess && (
              <div className="alert alert-success py-1 px-2 small mb-2">{resendSuccess}</div>
            )}
            <button
              type="button"
              className="btn btn-outline-dark btn-sm w-100"
              onClick={() => handleResend(unverifiedLoginEmail)}
              disabled={resending || cooldown > 0}
            >
              {resending ? (
                <><span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />Sending link…</>
              ) : cooldown > 0 ? (
                `Resend available in ${cooldown}s`
              ) : (
                <>
                  <i className="bi bi-send me-1" aria-hidden="true" />
                  {t('auth.resendEmail')}
                </>
              )}
            </button>
          </div>
        ) : (
          (error || authError) && <div className="alert alert-danger" role="alert">{error || authError}</div>
        )}

        <div className="mb-3">
          <GoogleSignInButton
            onCredentialReceived={handleGoogleCredential}
            disabled={submitting}
            text={isRegister ? 'Sign up with Google' : 'Continue with Google'}
          />
        </div>

        <div className="auth-divider">
          <span>{t('auth.orContinueWithEmail')}</span>
        </div>

        <form onSubmit={submit}>
          {isRegister && (
            <div className="mb-3">
              <label className="form-label" htmlFor="name">{t('auth.nameLabel')}</label>
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
            <label className="form-label" htmlFor="email">{t('auth.emailLabel')}</label>
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
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label mb-0" htmlFor="password">{t('auth.passwordLabel')}</label>
              {!isRegister && (
                <Link to="/forgot-password" className="auth-forgot-link">
                  {t('auth.forgotPassword')}
                </Link>
              )}
            </div>
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
            {isRegister && <div className="form-text">{t('auth.passwordHint')}</div>}
          </div>

          {/* Role Selection during Registration */}
          {isRegister && (
            <div className="mb-4">
              <label className="form-label fw-semibold text-dark d-block mb-2">
                {t('auth.roleSelectionLabel')}
              </label>
              <div className="row g-2">
                <div className="col-12 col-sm-6">
                  <div
                    className={`card p-3 h-100 border text-start cursor-pointer position-relative ${selectedRole === 'user' ? 'border-primary bg-primary bg-opacity-10 shadow-sm' : 'border-light-subtle bg-white'}`}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onClick={() => setSelectedRole('user')}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="d-flex align-items-center gap-2">
                        <i className={`bi bi-person-badge ${selectedRole === 'user' ? 'text-primary' : 'text-secondary'}`} style={{ fontSize: '1.25rem' }} />
                        <span className="fw-bold small text-dark">{t('auth.roleUserTitle')}</span>
                      </div>
                      <input
                        type="radio"
                        name="selectedRole"
                        value="user"
                        checked={selectedRole === 'user'}
                        onChange={() => setSelectedRole('user')}
                        className="form-check-input mt-0"
                      />
                    </div>
                    <p className="text-secondary small mb-0" style={{ fontSize: '0.78rem', lineHeight: '1.3' }}>
                      {t('auth.roleUserDesc')}
                    </p>
                  </div>
                </div>

                <div className="col-12 col-sm-6">
                  <div
                    className={`card p-3 h-100 border text-start cursor-pointer position-relative ${selectedRole === 'admin' ? 'border-primary bg-primary bg-opacity-10 shadow-sm' : 'border-light-subtle bg-white'}`}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onClick={() => setSelectedRole('admin')}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="d-flex align-items-center gap-2">
                        <i className={`bi bi-shield-lock ${selectedRole === 'admin' ? 'text-primary' : 'text-secondary'}`} style={{ fontSize: '1.25rem' }} />
                        <span className="fw-bold small text-dark">{t('auth.roleAdminTitle')}</span>
                      </div>
                      <input
                        type="radio"
                        name="selectedRole"
                        value="admin"
                        checked={selectedRole === 'admin'}
                        onChange={() => setSelectedRole('admin')}
                        className="form-check-input mt-0"
                      />
                    </div>
                    <p className="text-secondary small mb-0" style={{ fontSize: '0.78rem', lineHeight: '1.3' }}>
                      {t('auth.roleAdminDesc')}
                    </p>
                  </div>
                </div>
              </div>

              {selectedRole === 'admin' && (
                <div className="alert alert-warning py-2 px-3 small mt-2 mb-0 d-flex align-items-start gap-2 border-0 bg-warning bg-opacity-10 text-dark">
                  <i className="bi bi-shield-exclamation text-warning flex-shrink-0 mt-1" />
                  <span>{t('auth.roleAdminDesc')}</span>
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
            {submitting ? (
              <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />{t('auth.submitting')}</>
            ) : isRegister ? t('auth.createAccountBtn') : t('auth.signInBtn')}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? t('auth.alreadyHaveAccount') : t('auth.newToApp')}{' '}
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? t('auth.signInBtn') : t('auth.createAccountBtn')}
          </Link>
        </p>
      </div>
    </section>
  );
};

export default AuthPage;
