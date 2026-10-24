import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';

const VerifyEmailPage = () => {
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get('token');
  const token = paramToken || queryToken || '';

  const { checkVerifyEmail, verifyEmail, resendVerification } = useAuth();
  const { t } = useLanguage();

  const [status, setStatus] = useState(token ? 'checking' : 'request_new');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Read-only token pre-check on load (safe from email scanner pre-fetch state mutation)
  useEffect(() => {
    if (!token) return;

    let active = true;
    const verifyTokenReadiness = async () => {
      try {
        const result = await checkVerifyEmail(token);
        if (active) {
          if (result.alreadyVerified) {
            setStatus('already_verified');
          } else {
            setStatus('ready');
            setMaskedEmail(result.email || '');
          }
        }
      } catch (err) {
        if (active) {
          setStatus('invalid_or_expired');
          setErrorMessage(err.message || 'Verification link is invalid, expired, or has already been used.');
        }
      }
    };

    verifyTokenReadiness();
    return () => {
      active = false;
    };
  }, [token, checkVerifyEmail]);

  // Confirm verification action (triggers state-mutating POST)
  const handleConfirmVerification = async () => {
    setErrorMessage('');
    setStatus('verifying');
    try {
      await verifyEmail(token);
      setStatus('success');
    } catch (err) {
      setStatus('invalid_or_expired');
      setErrorMessage(err.message || 'Verification failed. Please try requesting a new link.');
    }
  };

  // Resend verification link
  const handleResend = async (e) => {
    if (e) e.preventDefault();
    if (!resendEmail.trim() || resending || cooldown > 0) return;

    setResending(true);
    setResendError('');
    setResendSuccess('');
    try {
      const result = await resendVerification(resendEmail.trim());
      if (result.alreadyVerified) {
        setStatus('already_verified');
      } else {
        setResendSuccess(result.message || 'Verification link sent! Check your inbox.');
        setCooldown(60);
      }
    } catch (err) {
      setResendError(err.message || 'Failed to resend verification email.');
      if (err.data?.retryAfter) {
        setCooldown(err.data.retryAfter);
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <section className="auth-layout">
      <div className="auth-panel text-center">
        <Link className="brand-mark auth-brand mx-auto mb-3" to="/" aria-label="AgriTech home">
          <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
          <span>Agri<span className="brand-accent">Tech</span></span>
        </Link>

        {/* 1. Checking Token State */}
        {status === 'checking' && (
          <div className="py-4" role="status" aria-live="polite">
            <span className="spinner-border text-success mb-3" style={{ width: '2.5rem', height: '2.5rem' }} aria-hidden="true" />
            <h2 className="h4 fw-bold mb-2">Validating link…</h2>
            <p className="text-secondary small mb-0">Please wait while we verify your activation link.</p>
          </div>
        )}

        {/* 2. Ready to Confirm State (Scanner Pre-fetch Protected) */}
        {status === 'ready' && (
          <div className="py-2">
            <div className="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success p-3" style={{ width: '64px', height: '64px' }}>
              <i className="bi bi-shield-check" style={{ fontSize: '2rem' }} aria-hidden="true" />
            </div>
            <h1 className="h3 fw-bold mb-2">{t('profile.emailVerification')}</h1>
            <p className="text-secondary small mb-4">
              Click the button below to confirm your address
              {maskedEmail ? <> for <strong className="text-dark">{maskedEmail}</strong></> : ''} and activate your AgriTech account.
            </p>
            <button
              className="btn btn-primary btn-lg w-100 mb-3"
              type="button"
              onClick={handleConfirmVerification}
            >
              <i className="bi bi-check2-circle me-2" aria-hidden="true" />
              {t('common.confirm')} &amp; {t('profile.emailVerification')}
            </button>
            <p className="text-muted small">
              This confirmation step prevents automated scanners from consuming your one-time link.
            </p>
          </div>
        )}

        {/* 3. Verifying In Progress */}
        {status === 'verifying' && (
          <div className="py-4" role="status" aria-live="polite">
            <span className="spinner-border text-success mb-3" style={{ width: '2.5rem', height: '2.5rem' }} aria-hidden="true" />
            <h2 className="h4 fw-bold mb-2">Activating your account…</h2>
            <p className="text-secondary small mb-0">Securing your farm credentials.</p>
          </div>
        )}

        {/* 4. Success State */}
        {status === 'success' && (
          <div className="py-2">
            <div className="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success p-3" style={{ width: '64px', height: '64px' }}>
              <i className="bi bi-check-circle-fill" style={{ fontSize: '2.2rem' }} aria-hidden="true" />
            </div>
            <h1 className="h3 fw-bold mb-2">Email Verified!</h1>
            <p className="text-secondary small mb-4">
              Your email address has been successfully verified. Your account is now active and ready to manage your farm and fields.
            </p>
            <Link to="/login" className="btn btn-primary btn-lg w-100 mb-3">
              Proceed to Sign In
              <i className="bi bi-arrow-right ms-2" aria-hidden="true" />
            </Link>
          </div>
        )}

        {/* 5. Already Verified State */}
        {status === 'already_verified' && (
          <div className="py-2">
            <div className="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle bg-info bg-opacity-10 text-primary p-3" style={{ width: '64px', height: '64px' }}>
              <i className="bi bi-patch-check-fill" style={{ fontSize: '2.2rem' }} aria-hidden="true" />
            </div>
            <h1 className="h3 fw-bold mb-2">Already Verified</h1>
            <p className="text-secondary small mb-4">
              This email address is already verified. You can sign in directly to access your farm workspace.
            </p>
            <Link to="/login" className="btn btn-primary btn-lg w-100 mb-3">
              Go to Sign In
              <i className="bi bi-box-arrow-in-right ms-2" aria-hidden="true" />
            </Link>
          </div>
        )}

        {/* 6. Invalid or Expired State */}
        {status === 'invalid_or_expired' && (
          <div className="py-2 text-start">
            <div className="text-center mb-3">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger bg-opacity-10 text-danger p-3" style={{ width: '64px', height: '64px' }}>
                <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '2rem' }} aria-hidden="true" />
              </div>
              <h1 className="h3 fw-bold mt-2 mb-1">Link Expired or Invalid</h1>
              <p className="text-secondary small mb-3">
                {errorMessage || 'This verification link may have expired (valid for 24 hours), already been used, or is invalid.'}
              </p>
            </div>

            {resendSuccess && (
              <div className="alert alert-success d-flex align-items-center gap-2 small mb-3" role="alert">
                <i className="bi bi-check-circle-fill flex-shrink-0" />
                <div>{resendSuccess}</div>
              </div>
            )}

            {resendError && (
              <div className="alert alert-danger d-flex align-items-center gap-2 small mb-3" role="alert">
                <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
                <div>{resendError}</div>
              </div>
            )}

            <form onSubmit={handleResend} className="mb-3">
              <label className="form-label small fw-semibold" htmlFor="resend-email">
                Request a new verification link
              </label>
              <div className="mb-3">
                <input
                  id="resend-email"
                  type="email"
                  className="form-control"
                  placeholder="Enter your registered email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-outline-primary w-100"
                disabled={resending || cooldown > 0 || !resendEmail.trim()}
              >
                {resending ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Sending…</>
                ) : cooldown > 0 ? (
                  `Resend available in ${cooldown}s`
                ) : (
                  <>
                    <i className="bi bi-send me-2" aria-hidden="true" />
                    Resend Verification Email
                  </>
                )}
              </button>
            </form>

            <div className="text-center">
              <Link to="/login" className="small text-decoration-none">
                <i className="bi bi-arrow-left me-1" />
                Back to Sign In
              </Link>
            </div>
          </div>
        )}

        {/* 7. Request New Verification Link Form (no token provided) */}
        {status === 'request_new' && (
          <div className="py-2 text-start">
            <div className="text-center mb-3">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success p-3" style={{ width: '64px', height: '64px' }}>
                <i className="bi bi-envelope-paper" style={{ fontSize: '2rem' }} aria-hidden="true" />
              </div>
              <h1 className="h3 fw-bold mt-2 mb-1">Verify Your Email</h1>
              <p className="text-secondary small mb-3">
                Enter your email address below to receive an account activation link.
              </p>
            </div>

            {resendSuccess && (
              <div className="alert alert-success d-flex align-items-center gap-2 small mb-3" role="alert">
                <i className="bi bi-check-circle-fill flex-shrink-0" />
                <div>{resendSuccess}</div>
              </div>
            )}

            {resendError && (
              <div className="alert alert-danger d-flex align-items-center gap-2 small mb-3" role="alert">
                <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
                <div>{resendError}</div>
              </div>
            )}

            <form onSubmit={handleResend} className="mb-3">
              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="verify-email-input">
                  Email address
                </label>
                <input
                  id="verify-email-input"
                  type="email"
                  className="form-control"
                  placeholder="name@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={resending || cooldown > 0 || !resendEmail.trim()}
              >
                {resending ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Sending link…</>
                ) : cooldown > 0 ? (
                  `Resend available in ${cooldown}s`
                ) : (
                  'Send Verification Link'
                )}
              </button>
            </form>

            <div className="text-center">
              <Link to="/login" className="small text-decoration-none">
                <i className="bi bi-arrow-left me-1" />
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default VerifyEmailPage;
