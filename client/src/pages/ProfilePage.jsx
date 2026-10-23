import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import LanguageToggle from '../components/LanguageToggle.jsx';

const ProfilePage = () => {
  const { user, setUser, updateProfile, resendVerification, verifyEmail } = useAuth();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    farmName: user?.farmName || '',
    farmSizeHectares: user?.farmSizeHectares || '',
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Email verification state
  const [resending, setResending] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [prevUser, setPrevUser] = useState(user);
  if (user && user !== prevUser) {
    setPrevUser(user);
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
      farmName: user.farmName || '',
      farmSizeHectares: user.farmSizeHectares || '',
    });
  }

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const res = await updateProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        farmName: form.farmName.trim(),
        farmSizeHectares: form.farmSizeHectares ? Number(form.farmSizeHectares) : undefined,
      });
      setSaveSuccess(res.message || 'Profile updated successfully.');
    } catch (err) {
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    if (resending || cooldown > 0 || !user?.email) return;
    setResending(true);
    setVerificationSuccess('');
    setVerificationError('');
    try {
      const res = await resendVerification(user.email);
      setVerificationSuccess(res.message || 'Verification email sent! Check your inbox.');
      setCooldown(60);
    } catch (err) {
      setVerificationError(err.message || 'Failed to send verification email.');
      if (err.data?.retryAfter) {
        setCooldown(err.data.retryAfter);
      }
    } finally {
      setResending(false);
    }
  };

  const handleVerifyWithToken = async (e) => {
    e.preventDefault();
    if (!verifyToken.trim() || verifyingToken) return;
    setVerifyingToken(true);
    setVerificationSuccess('');
    setVerificationError('');
    try {
      const res = await verifyEmail(verifyToken.trim());
      setVerificationSuccess(res.message || 'Email verified successfully!');
      if (res.user) {
        setUser(res.user);
      } else {
        setUser((prev) => ({ ...prev, emailVerified: true }));
      }
      setVerifyToken('');
    } catch (err) {
      setVerificationError(err.message || 'Invalid or expired token.');
    } finally {
      setVerifyingToken(false);
    }
  };

  const formattedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  return (
    <div className="container-fluid p-0">
      {/* Top Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <span className="topbar-breadcrumb">Account / Settings</span>
          <h1 className="h3 fw-bold topbar-heading mb-1">User Profile</h1>
          <p className="text-muted small mb-0">
            Manage your personal contact information, farm identity, and email verification.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-arrow-left me-1" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Profile Card & Email Verification */}
        <div className="col-12 col-lg-5 col-xl-4">
          {/* Identity Summary Card */}
          <div className="card shadow-sm border-0 rounded-3 mb-4">
            <div className="card-body p-4 text-center">
              <div
                className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold text-white mb-3"
                style={{
                  width: '76px',
                  height: '76px',
                  fontSize: '1.75rem',
                  background: 'linear-gradient(135deg, #2d5a27 0%, #447a3c 100%)',
                }}
              >
                {user?.name
                  ? user.name
                      .split(/\s+/)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'F'}
              </div>
              <h2 className="h5 fw-bold mb-1">{user?.name || 'Farmer'}</h2>
              <p className="text-muted small mb-2">{user?.email}</p>

              <div className="d-flex justify-content-center flex-wrap gap-2 mb-3">
                <span className={`badge ${user?.role === 'admin' ? 'bg-primary' : 'bg-secondary'} text-uppercase`} style={{ fontSize: '0.72rem' }}>
                  {user?.role === 'admin' ? 'Administrator' : 'Farmer / User'}
                </span>
                <span className={`badge ${user?.status === 'suspended' ? 'bg-danger text-white' : 'bg-success-subtle text-success border border-success-subtle'}`} style={{ fontSize: '0.72rem' }}>
                  {user?.status === 'suspended' ? t('profile.suspended') : t('profile.active')}
                </span>
                {user?.emailVerified ? (
                  <span className="badge bg-success d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                    <i className="bi bi-shield-check" /> {t('profile.verifiedBadge')}
                  </span>
                ) : (
                  <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                    <i className="bi bi-exclamation-triangle-fill" /> {t('profile.unverifiedBadge')}
                  </span>
                )}
              </div>

              {/* Role Request Status Notification */}
              {user?.roleRequest?.status === 'pending' && (
                <div className="alert alert-warning text-start py-2 px-3 small rounded-3 mb-3 border-0 bg-warning bg-opacity-10 text-dark">
                  <div className="fw-bold d-flex align-items-center gap-1 mb-1">
                    <i className="bi bi-clock-history text-warning" />
                    <span>{t('profile.adminPendingTitle')}</span>
                  </div>
                  <p className="mb-0" style={{ fontSize: '0.78rem' }}>
                    {t('profile.adminPendingDesc', {
                      date: user.roleRequest.requestedAt ? new Date(user.roleRequest.requestedAt).toLocaleDateString() : 'Recently',
                    })}
                  </p>
                </div>
              )}

              {user?.roleRequest?.status === 'rejected' && (
                <div className="alert alert-secondary text-start py-2 px-3 small rounded-3 mb-3 border-0 bg-light text-muted">
                  <div className="fw-bold d-flex align-items-center gap-1 mb-1">
                    <i className="bi bi-info-circle text-secondary" />
                    <span>{t('profile.adminRejectedTitle')}</span>
                  </div>
                  <p className="mb-0" style={{ fontSize: '0.78rem' }}>
                    {t('profile.adminRejectedDesc')}
                  </p>
                </div>
              )}

              <hr className="my-3 opacity-25" />

              <div className="text-start small">
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">{t('profile.memberSince')}:</span>
                  <span className="fw-semibold">{formattedDate}</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">Login provider:</span>
                  <span className="fw-semibold">
                    {user?.googleId ? (
                      <span className="text-primary"><i className="bi bi-google me-1" /> Google</span>
                    ) : (
                      'Email & Password'
                    )}
                  </span>
                </div>
                {user?.farmName && (
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Primary Farm:</span>
                    <span className="fw-semibold text-truncate ms-2" style={{ maxWidth: '160px' }}>
                      {user.farmName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Language Preference Card */}
          <div className="card shadow-sm border-0 rounded-3 mb-4">
            <div className="card-body p-3 p-md-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-translate text-primary" style={{ fontSize: '1.25rem' }} />
                  <h3 className="h6 fw-bold mb-0">{t('profile.languagePref')}</h3>
                </div>
                <LanguageToggle size="sm" />
              </div>
              <p className="text-muted small mb-0">
                {t('profile.languageHelp')}
              </p>
            </div>
          </div>

          {/* Email Verification Box */}
          <div className={`card shadow-sm border-0 rounded-3 mb-4 ${user?.emailVerified ? 'bg-light' : 'border-warning'}`}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <i
                  className={`bi ${user?.emailVerified ? 'bi-check-circle-fill text-success' : 'bi-shield-exclamation text-warning'}`}
                  style={{ fontSize: '1.4rem' }}
                />
                <h3 className="h6 fw-bold mb-0">Email Verification</h3>
              </div>

              {user?.emailVerified ? (
                <div>
                  <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 small mb-2">
                    <i className="bi bi-shield-check flex-shrink-0" />
                    <div>Your email address is verified and active.</div>
                  </div>
                  <p className="text-muted small mb-0">
                    Your account has full security privileges, password recovery protection, and operational alerts enabled.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-muted small mb-3">
                    Your email address (<strong>{user?.email}</strong>) has not been verified yet. Complete verification now to safeguard your farm data.
                  </p>

                  {verificationSuccess && (
                    <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 small mb-3">
                      <i className="bi bi-check-circle-fill flex-shrink-0" />
                      <div>{verificationSuccess}</div>
                    </div>
                  )}

                  {verificationError && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small mb-3">
                      <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
                      <div>{verificationError}</div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-warning w-100 fw-semibold mb-3 d-flex align-items-center justify-content-center gap-2"
                    onClick={handleSendVerificationEmail}
                    disabled={resending || cooldown > 0}
                  >
                    {resending ? (
                      <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Sending Email…</>
                    ) : cooldown > 0 ? (
                      `Resend available in ${cooldown}s`
                    ) : (
                      <>
                        <i className="bi bi-send" />
                        Send Verification Email
                      </>
                    )}
                  </button>

                  <div className="border-top pt-3">
                    <form onSubmit={handleVerifyWithToken}>
                      <label className="form-label small fw-semibold text-muted" htmlFor="token-input">
                        Have a verification token?
                      </label>
                      <div className="input-group input-group-sm mb-2">
                        <input
                          id="token-input"
                          type="text"
                          className="form-control"
                          placeholder="Paste verification token"
                          value={verifyToken}
                          onChange={(e) => setVerifyToken(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={verifyingToken || !verifyToken.trim()}
                        >
                          {verifyingToken ? 'Verifying…' : 'Verify'}
                        </button>
                      </div>
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Or click the activation link directly in the email you received.
                      </small>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Editable Profile Details */}
        <div className="col-12 col-lg-7 col-xl-8">
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white border-bottom py-3 px-4">
              <h3 className="h6 fw-bold mb-0">Personal & Farm Information</h3>
            </div>
            <div className="card-body p-4">
              {saveSuccess && (
                <div className="alert alert-success d-flex align-items-center gap-2 small mb-3" role="alert">
                  <i className="bi bi-check-circle-fill flex-shrink-0" />
                  <div>{saveSuccess}</div>
                </div>
              )}

              {saveError && (
                <div className="alert alert-danger d-flex align-items-center gap-2 small mb-3" role="alert">
                  <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
                  <div>{saveError}</div>
                </div>
              )}

              <form onSubmit={handleSaveProfile}>
                <div className="row g-3">
                  {/* Full Name */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-name">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="profile-name"
                      name="name"
                      type="text"
                      className="form-control"
                      value={form.name}
                      onChange={handleChange}
                      maxLength={50}
                      required
                    />
                  </div>

                  {/* Email Address (Read-only) */}
                  <div className="col-12 col-md-6">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label small fw-semibold mb-0" htmlFor="profile-email">
                        Email Address
                      </label>
                      {user?.emailVerified ? (
                        <span className="badge bg-success-subtle text-success small" style={{ fontSize: '0.7rem' }}>
                          Verified
                        </span>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning-emphasis small" style={{ fontSize: '0.7rem' }}>
                          Unverified
                        </span>
                      )}
                    </div>
                    <input
                      id="profile-email"
                      type="email"
                      className="form-control bg-light"
                      value={user?.email || ''}
                      disabled
                      readOnly
                    />
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Primary identifier used for security and notifications.
                    </small>
                  </div>

                  {/* Phone Number */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-phone">
                      Phone Number
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-telephone" />
                      </span>
                      <input
                        id="profile-phone"
                        name="phone"
                        type="tel"
                        className="form-control"
                        placeholder="+91 98765 43210"
                        value={form.phone}
                        onChange={handleChange}
                        maxLength={30}
                      />
                    </div>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Used for SMS weather alerts and operational dispatch.
                    </small>
                  </div>

                  {/* Farm Name */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-farm-name">
                      Farm or Entity Name
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-houses" />
                      </span>
                      <input
                        id="profile-farm-name"
                        name="farmName"
                        type="text"
                        className="form-control"
                        placeholder="e.g. Green Valley Farm"
                        value={form.farmName}
                        onChange={handleChange}
                        maxLength={100}
                      />
                    </div>
                  </div>

                  {/* Farm Size */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-farm-size">
                      Farm Area (Hectares)
                    </label>
                    <div className="input-group">
                      <input
                        id="profile-farm-size"
                        name="farmSizeHectares"
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        placeholder="e.g. 15.5"
                        value={form.farmSizeHectares}
                        onChange={handleChange}
                      />
                      <span className="input-group-text bg-light text-muted">ha</span>
                    </div>
                  </div>

                  {/* Account Role (Readonly) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-role">
                      Assigned Role
                    </label>
                    <input
                      id="profile-role"
                      type="text"
                      className="form-control bg-light text-capitalize"
                      value={user?.role || 'Farmer'}
                      disabled
                      readOnly
                    />
                  </div>

                  {/* Address */}
                  <div className="col-12">
                    <label className="form-label small fw-semibold" htmlFor="profile-address">
                      Physical Farm Address
                    </label>
                    <textarea
                      id="profile-address"
                      name="address"
                      rows={3}
                      className="form-control"
                      placeholder="Enter street, village, district, state, and postal code"
                      value={form.address}
                      onChange={handleChange}
                      maxLength={200}
                    />
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Accurate address information helps pinpoint microclimate and localized agro-weather data.
                    </small>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-top d-flex justify-content-end gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary px-4 fw-semibold"
                    disabled={saving}
                  >
                    {saving ? (
                      <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Saving Changes…</>
                    ) : (
                      <>
                        <i className="bi bi-check2 me-1" />
                        Save Profile Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
