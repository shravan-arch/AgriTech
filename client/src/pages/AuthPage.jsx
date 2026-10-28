import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import LanguageToggle from '../components/LanguageToggle.jsx';
import SEO from '../components/SEO.jsx';

const AUTH_SLIDES = [
  {
    image: '/images/smart-drone-field.jpg',
    quote: 'Precision drone intelligence and telemetry keeps every hectare in optimal condition.',
    author: 'Harpreet Singh • Punjab Agro Collective',
    badge: '98.4% Spatial Precision',
  },
  {
    image: '/images/golden-wheat-sunset.jpg',
    quote: 'Predictive growth stages helped us forecast our seasonal harvest 4 weeks ahead.',
    author: 'Rajendra Patel • Central Grain Producers',
    badge: '+24% YoY Yield Boost',
  },
  {
    image: '/images/smart-greenhouse-iot.jpg',
    quote: 'Automated climate telemetry and soil alerts cut irrigation waste by over 30%.',
    author: 'Ananya Sharma • AgriTech Smart Greenhouse',
    badge: 'Real-time IoT Telemetry',
  },
];

const AuthPage = ({ mode }) => {
  const isRegister = mode === 'register';
  const { user, isAuthenticated, authError, clearAuthError, login, googleLogin, register, resendVerification, logout, verifyEmail } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [authPortal, setAuthPortal] = useState('user'); // 'user' or 'admin'
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  // Email verification pending states
  const [verificationPendingEmail, setVerificationPendingEmail] = useState('');
  const [unverifiedLoginEmail, setUnverifiedLoginEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // OTP / Verification Token direct input states
  const [manualToken, setManualToken] = useState('');
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState('');

  // Background slideshow rotation
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % AUTH_SLIDES.length);
    }, 6000);
    return () => clearInterval(slideTimer);
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  const update = (event) => {
    if (error) setError('');
    if (authError && clearAuthError) clearAuthError();
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  // Password strength calculation for registration
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { percent: 0, label: '', color: 'bg-secondary' };
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 25;

    if (score <= 25) return { percent: 25, label: 'Weak', color: 'bg-danger' };
    if (score <= 50) return { percent: 50, label: 'Fair', color: 'bg-warning' };
    if (score <= 75) return { percent: 75, label: 'Good', color: 'bg-info' };
    return { percent: 100, label: 'Strong', color: 'bg-success' };
  };

  const strength = isRegister ? getPasswordStrength(form.password) : null;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (clearAuthError) clearAuthError();
    setUnverifiedLoginEmail('');
    setResendSuccess('');
    setVerifySuccess('');
    setSubmitting(true);
    try {
      if (isRegister) {
        const result = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          language,
        });

        if (result?.requiresEmailVerification || !result?.token) {
          setVerificationPendingEmail(form.email.trim());
          setCooldown(60);
          return;
        }

        navigate('/dashboard', { replace: true });
      } else {
        const result = await login(form.email.trim(), form.password, authPortal);
        const loggedUser = result?.user;

        if (authPortal === 'admin') {
          if (loggedUser?.role !== 'admin') {
            logout();
            setError('Access Denied: This account does not possess Administrative privileges. Please switch to Login as Farmer/User.');
            return;
          }
          navigate('/admin', { replace: true });
        } else {
          if (loggedUser?.role === 'admin') {
            logout();
            setError('Administrator accounts must log in using the Login as Admin option.');
            return;
          }
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (requestError) {
      if (
        requestError.data?.code === 'EMAIL_NOT_VERIFIED' ||
        requestError.message?.toLowerCase().includes('verify your email')
      ) {
        setUnverifiedLoginEmail(form.email.trim());
      }
      if (requestError.data?.code === 'ACCOUNT_SUSPENDED') {
        setError(t('auth.accountSuspended'));
      } else if (requestError.data?.code === 'ADMIN_PORTAL_REQUIRED') {
        setError('Administrator accounts must log in using the Login as Admin option.');
      } else if (requestError.data?.code === 'NOT_AN_ADMIN') {
        setError('Access Denied: This account does not possess Administrative privileges.');
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

  const handleTokenSubmit = async (e) => {
    e.preventDefault();
    if (!manualToken.trim() || verifyingToken) return;
    setVerifyingToken(true);
    setError('');
    setVerifySuccess('');
    try {
      const result = await verifyEmail(manualToken.trim());
      setVerifySuccess(result.message || 'Email verified successfully! You can now log in.');
      setTimeout(() => {
        setVerificationPendingEmail('');
        navigate('/login');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Invalid or expired verification token.');
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleGoogleCredential = useCallback(async (credential) => {
    setError('');
    if (clearAuthError) clearAuthError();
    setSubmitting(true);
    try {
      const result = await googleLogin(credential, authPortal);
      const loggedUser = result?.user;
      if (authPortal === 'admin') {
        if (loggedUser?.role !== 'admin') {
          logout();
          setError('Access Denied: This Google account does not have Administrator privileges. Please sign in via Login as Farmer/User.');
          return;
        }
        navigate('/admin', { replace: true });
      } else {
        if (loggedUser?.role === 'admin') {
          logout();
          setError('Administrator accounts must sign in using the Login as Admin option.');
          return;
        }
        navigate('/dashboard', { replace: true });
      }
    } catch (googleError) {
      if (googleError.data?.code === 'ACCOUNT_SUSPENDED') {
        setError(t('auth.accountSuspended'));
      } else if (googleError.data?.code === 'ADMIN_PORTAL_REQUIRED') {
        setError('Administrator accounts must sign in using the Login as Admin option.');
      } else if (googleError.data?.code === 'NOT_AN_ADMIN') {
        setError('Access Denied: This Google account does not have Administrator privileges.');
      } else {
        setError(googleError.message || 'Google authentication failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [googleLogin, clearAuthError, authPortal, logout, navigate, t]);

  // Dedicated "Check your email" pending screen
  if (verificationPendingEmail) {
    return (
      <section className="auth-split-wrapper">
        <SEO
          title="Verify Your Email - AgriTech"
          robots="noindex, nofollow"
        />
        <div className="auth-single-card text-center shadow-lg">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <Link className="landing-brand mb-0" to="/" aria-label="AgriTech home">
              <span className="brand-logo-glow">
                <svg viewBox="0 0 40 40" width="34" height="34" className="brand-svg-icon" aria-hidden="true">
                  <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f291e" stroke="#10b981" strokeWidth="1.5" />
                  <path d="M20 32 C20 24 19 18 16 13" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                  <path d="M19 21 C12 20 8 14 9 9 C14 9 18 13 19 21 Z" fill="#10b981" />
                  <path d="M20 17 C26 14 31 17 31 22 C26 23 21 21 20 17 Z" fill="#34d399" />
                  <circle cx="29" cy="11" r="3" fill="#f59e0b" />
                </svg>
              </span>
              <span className="brand-text">Agri<span className="brand-text-accent">Tech</span></span>
            </Link>
            <LanguageToggle />
          </div>

          <div className="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success p-3" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-envelope-check" style={{ fontSize: '2rem' }} aria-hidden="true" />
          </div>

          <h1 className="h3 fw-bold mb-2">Verify Your Email Address</h1>
          <p className="text-secondary small mb-3">
            We have sent a verification link to <strong className="text-dark">{verificationPendingEmail}</strong>.
            Please verify your email before logging in.
          </p>



          {verifySuccess && (
            <div className="alert alert-success d-flex align-items-center gap-2 small mb-3" role="alert">
              <i className="bi bi-check-circle-fill flex-shrink-0" />
              <div>{verifySuccess}</div>
            </div>
          )}

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

          <div className="card bg-light border-0 p-3 mb-3 text-start small">
            <label className="form-label small fw-semibold text-dark mb-1" htmlFor="manual-token-input">
              Enter verification token / link
            </label>
            <form onSubmit={handleTokenSubmit} className="d-flex gap-2">
              <input
                id="manual-token-input"
                type="text"
                className="form-control form-control-sm"
                placeholder="Paste token from email"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={verifyingToken}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm flex-shrink-0"
                disabled={verifyingToken || !manualToken.trim()}
              >
                {verifyingToken ? (
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                ) : (
                  'Confirm'
                )}
              </button>
            </form>
          </div>

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
    <div className="auth-split-wrapper">
      <SEO
        title={isRegister ? 'Register Farm Account - AgriTech Precision Agriculture' : 'Farmer Sign In - AgriTech Farm Management'}
        description={isRegister ? 'Create your free AgriTech agricultural account. Begin mapping farm fields, tracking crop growth cycles, and monitoring soil telemetry.' : 'Sign in to your private AgriTech farm management workspace to access GPS field mapping, IoT telemetry, and crop schedules.'}
        canonicalUrl={isRegister ? 'https://agritech-bay.vercel.app/register' : 'https://agritech-bay.vercel.app/login'}
        robots="index, follow"
      />
      <div className="row g-0 w-100 min-vh-100">
        {/* Left Visual Column with Animated Farm Slideshow */}
        <div className="col-12 col-lg-5 col-xl-6 d-none d-lg-block position-relative auth-visual-side">
          {AUTH_SLIDES.map((slide, idx) => (
            <div
              key={idx}
              className={`auth-visual-slide ${idx === activeSlide ? 'is-active' : ''}`}
            >
              <img
                src={slide.image}
                alt="AgriTech Farm"
                className="auth-visual-img"
                loading={idx === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
              <div className="auth-visual-scrim" />
              <div className="auth-visual-caption">
                <span className="badge bg-success bg-opacity-25 text-white border border-white border-opacity-25 px-3 py-1 rounded-pill mb-3">
                  <i className="bi bi-shield-check me-1" />
                  {slide.badge}
                </span>
                <blockquote className="auth-visual-quote">
                  &ldquo;{slide.quote}&rdquo;
                </blockquote>
                <p className="auth-visual-author">{slide.author}</p>
              </div>
            </div>
          ))}

          {/* Floating animated telemetry pill */}
          <div className="floating-badge auth-floating-pill">
            <span className="live-pulse-dot" />
            <div>
              <div className="floating-badge-title">Telemetry Sensor Node</div>
              <div className="floating-badge-val">99.8% Reliability • Live</div>
            </div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="col-12 col-lg-7 col-xl-6 d-flex align-items-center justify-content-center p-3 p-sm-4 p-md-5 auth-form-side">
          <div className="auth-card-panel animate-fadeIn">
            {/* Header: Brand and Language Toggle */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Link className="landing-brand mb-0" to="/" aria-label="AgriTech home">
                <span className="brand-logo-glow">
                  <svg viewBox="0 0 40 40" width="34" height="34" className="brand-svg-icon" aria-hidden="true">
                    <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f291e" stroke="#10b981" strokeWidth="1.5" />
                    <path d="M20 32 C20 24 19 18 16 13" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                    <path d="M19 21 C12 20 8 14 9 9 C14 9 18 13 19 21 Z" fill="#10b981" />
                    <path d="M20 17 C26 14 31 17 31 22 C26 23 21 21 20 17 Z" fill="#34d399" />
                    <circle cx="29" cy="11" r="3" fill="#f59e0b" />
                  </svg>
                </span>
                <span className="brand-text">Agri<span className="brand-text-accent">Tech</span></span>
              </Link>
              <LanguageToggle />
            </div>

            {/* Login Options: Login as Farmer/User vs Login as Admin */}
            {!isRegister ? (
              <div className="auth-portal-selector mb-3" role="tablist" aria-label="Login Options">
                <button
                  type="button"
                  className={`auth-portal-tab ${authPortal === 'user' ? 'active' : ''}`}
                  onClick={() => {
                    setAuthPortal('user');
                    setError('');
                    setUnverifiedLoginEmail('');
                    if (clearAuthError) clearAuthError();
                  }}
                >
                  <i className="bi bi-person-fill" />
                  <span>Login as Farmer/User</span>
                </button>
                <button
                  type="button"
                  className={`auth-portal-tab admin-portal ${authPortal === 'admin' ? 'active' : ''}`}
                  onClick={() => {
                    setAuthPortal('admin');
                    setError('');
                    setUnverifiedLoginEmail('');
                    if (clearAuthError) clearAuthError();
                  }}
                >
                  <i className="bi bi-shield-lock-fill" />
                  <span>Login as Admin</span>
                </button>
              </div>
            ) : null}

            {!isRegister && authPortal === 'admin' && (
              <div className="admin-portal-banner d-flex align-items-center gap-2 small mb-3">
                <i className="bi bi-shield-shaded text-primary fs-5 flex-shrink-0" />
                <div>
                  <strong className="text-dark d-block">Enterprise Governance Gateway</strong>
                  <span className="text-secondary" style={{ fontSize: '0.78rem' }}>
                    Restricted administrative suite. Only approved, active administrators may access this gateway.
                  </span>
                </div>
              </div>
            )}

            {/* Segmented Mode Switcher */}
            <div className="auth-mode-pills mb-4">
              <Link
                to="/login"
                className={`auth-mode-pill ${!isRegister ? 'active' : ''}`}
                onClick={() => {
                  setError('');
                  setUnverifiedLoginEmail('');
                  if (clearAuthError) clearAuthError();
                }}
              >
                <i className="bi bi-box-arrow-in-right me-1" />
                {t('auth.signInBtn')}
              </Link>
              <Link
                to="/register"
                className={`auth-mode-pill ${isRegister ? 'active' : ''}`}
                onClick={() => {
                  setError('');
                  setUnverifiedLoginEmail('');
                  if (clearAuthError) clearAuthError();
                }}
              >
                <i className="bi bi-person-plus me-1" />
                {t('auth.createAccountBtn')}
              </Link>
            </div>

            <div className="auth-header-titles mb-3">
              <h1 className="h3 fw-bold mb-1">
                {isRegister
                  ? t('auth.createAccount')
                  : authPortal === 'admin'
                  ? 'Login as Admin'
                  : 'Login as Farmer/User'}
              </h1>
              <p className="text-secondary small mb-0">
                {isRegister
                  ? 'Register your details to create your AgriTech farm workspace.'
                  : authPortal === 'admin'
                  ? 'Enter your authorized administrator credentials to access platform governance.'
                  : 'Enter your credentials to access your farm operations, crops, and telemetry.'}
              </p>
            </div>

            {location.state?.message && !unverifiedLoginEmail && !error && !authError && (
              <div className="alert alert-success d-flex align-items-center gap-2 mb-3" role="alert">
                <i className="bi bi-check-circle-fill text-success flex-shrink-0" />
                <div className="small">{location.state.message}</div>
              </div>
            )}

            {unverifiedLoginEmail ? (
              <div className="alert alert-warning border-warning border-opacity-25 mb-3 text-start" role="alert">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-exclamation-triangle-fill text-warning flex-shrink-0" />
                  <strong className="text-dark">Email Verification Required</strong>
                </div>
                <p className="small mb-2 text-dark">
                  Please verify your email address before logging in. We sent a verification link to <strong>{unverifiedLoginEmail}</strong>.
                </p>
                {verifySuccess && (
                  <div className="alert alert-success py-1 px-2 small mb-2">{verifySuccess}</div>
                )}
                {resendSuccess && (
                  <div className="alert alert-success py-1 px-2 small mb-2">{resendSuccess}</div>
                )}
                <div className="mb-2">
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Paste verification token from email"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      disabled={verifyingToken}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleTokenSubmit}
                      disabled={verifyingToken || !manualToken.trim()}
                    >
                      {verifyingToken ? '…' : 'Verify'}
                    </button>
                  </div>
                </div>
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

            {/* Google Sign-in */}
            <div className="mb-3">
              <GoogleSignInButton
                onCredentialReceived={handleGoogleCredential}
                disabled={submitting}
                text={
                  isRegister
                    ? 'Register with Google'
                    : authPortal === 'admin'
                    ? 'Login with Google (Admin)'
                    : 'Login with Google (Farmer/User)'
                }
              />
            </div>

            <div className="auth-divider">
              <span>{t('auth.orContinueWithEmail')}</span>
            </div>

            <form onSubmit={submit}>
              {isRegister && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="name">{t('auth.nameLabel')}</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light text-secondary border-end-0">
                      <i className="bi bi-person" />
                    </span>
                    <input
                      id="name"
                      name="name"
                      className="form-control border-start-0 ps-1"
                      placeholder="e.g. Gurpreet Singh"
                      value={form.name}
                      onChange={update}
                      autoComplete="name"
                      maxLength={50}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label" htmlFor="email">{t('auth.emailLabel')}</label>
                <div className="input-group">
                  <span className="input-group-text bg-light text-secondary border-end-0">
                    <i className="bi bi-envelope" />
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-control border-start-0 ps-1"
                    placeholder={!isRegister && authPortal === 'admin' ? 'admin@agritech.com' : 'farmer@agritech.com'}
                    value={form.email}
                    onChange={update}
                    autoComplete="email"
                    required
                  />
                </div>
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
                <div className="input-group">
                  <span className="input-group-text bg-light text-secondary border-end-0">
                    <i className="bi bi-lock" />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-control border-start-0 border-end-0 ps-1"
                    placeholder="••••••••••••"
                    value={form.password}
                    onChange={update}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    minLength={isRegister ? 10 : undefined}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    className="input-group-text bg-light border-start-0 text-secondary"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>

                {isRegister && (
                  <div className="mt-2">
                    <div className="d-flex align-items-center justify-content-between small text-secondary mb-1">
                      <span>{t('auth.passwordHint')}</span>
                      {strength?.label && (
                        <span className="fw-semibold">{strength.label}</span>
                      )}
                    </div>
                    {form.password && (
                      <div className="progress" style={{ height: '5px' }}>
                        <div
                          className={`progress-bar ${strength.color} transition-all`}
                          style={{ width: `${strength.percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="btn btn-primary w-100 btn-lg shadow-sm landing-btn-cta" type="submit" disabled={submitting}>
                {submitting ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />{t('auth.submitting')}</>
                ) : isRegister ? (
                  <>
                    <span>{t('auth.createAccountBtn')}</span>
                    <i className="bi bi-person-check ms-2" />
                  </>
                ) : authPortal === 'admin' ? (
                  <>
                    <span>Login as Admin</span>
                    <i className="bi bi-shield-lock ms-2" />
                  </>
                ) : (
                  <>
                    <span>Login as Farmer/User</span>
                    <i className="bi bi-box-arrow-in-right ms-2" />
                  </>
                )}
              </button>
            </form>

            <p className="auth-switch text-center mt-4 mb-0">
              {isRegister ? t('auth.alreadyHaveAccount') : t('auth.newToApp')}{' '}
              <Link to={isRegister ? '/login' : '/register'} className="fw-bold text-success">
                {isRegister ? t('auth.signInBtn') : t('auth.createAccountBtn')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
