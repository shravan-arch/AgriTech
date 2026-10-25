import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { INDIAN_LANGUAGES } from '../lib/translations.js';

const ProfilePage = () => {
  const { user, setUser, updateProfile, resendVerification, verifyEmail, deleteAccount, listAdminUsers } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

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

  const isAdmin = user?.role === 'admin';

  // Email verification state
  const [resending, setResending] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState('');
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [adminCount, setAdminCount] = useState(null);

  const isGoogleOnly = Boolean(user?.googleId && !user?.hasPassword);

  useEffect(() => {
    let active = true;
    if (isAdmin && listAdminUsers) {
      listAdminUsers({ role: 'admin' })
        .then((res) => {
          if (active && res?.users) {
            const activeAdmins = res.users.filter((u) => u.role === 'admin' && u.status !== 'suspended');
            setAdminCount(activeAdmins.length);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [isAdmin, listAdminUsers]);

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount({
        password: deletePassword,
        confirmation: deleteConfirmPhrase.trim().toUpperCase(),
        confirmEmail: deleteConfirmEmail.trim(),
      });
      navigate('/login', {
        replace: true,
        state: {
          message: 'Your account and all associated farm data have been permanently deleted.',
        },
      });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account. Please verify your credentials.');
    } finally {
      setDeleting(false);
    }
  };

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
          <span className="topbar-breadcrumb">AgriTech / {t('nav.profile')}</span>
          <h1 className="h3 fw-bold topbar-heading mb-1">{t('profile.title')}</h1>
          <p className="text-muted small mb-0">
            {t('profile.subtitle')}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-arrow-left me-1" />
            {t('nav.overview')}
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
                  <i className="bi bi-translate text-success" style={{ fontSize: '1.25rem' }} />
                  <h3 className="h6 fw-bold mb-0">{t('profile.languagePref')}</h3>
                </div>
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill">
                  {INDIAN_LANGUAGES.find((item) => item.code === language)?.name || 'English'}
                </span>
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
                <h3 className="h6 fw-bold mb-0">{t('profile.emailVerification')}</h3>
              </div>

              {user?.emailVerified ? (
                <div>
                  <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 small mb-2">
                    <i className="bi bi-shield-check flex-shrink-0" />
                    <div>{t('profile.verifiedMessage')}</div>
                  </div>
                  <p className="text-muted small mb-0">
                    {t('profile.adminApprovedDesc')}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-muted small mb-3">
                    {t('profile.unverifiedWarning')} (<strong>{user?.email}</strong>)
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
                      t('profile.resendCooldown', { seconds: cooldown })
                    ) : (
                      <>
                        <i className="bi bi-send" />
                        {t('profile.sendVerification')}
                      </>
                    )}
                  </button>

                  <div className="border-top pt-3">
                    <form onSubmit={handleVerifyWithToken}>
                      <label className="form-label small fw-semibold text-muted" htmlFor="token-input">
                        {t('profile.tokenFormTitle')}
                      </label>
                      <div className="input-group input-group-sm mb-2">
                        <input
                          id="token-input"
                          type="text"
                          className="form-control"
                          placeholder={t('profile.tokenPlaceholder')}
                          value={verifyToken}
                          onChange={(e) => setVerifyToken(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={verifyingToken || !verifyToken.trim()}
                        >
                          {verifyingToken ? '…' : t('profile.verifyTokenBtn')}
                        </button>
                      </div>
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
              <h3 className="h6 fw-bold mb-0">{t('profile.personalInfo')}</h3>
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

              {isAdmin && (
                <div className="alert alert-info border-0 rounded-3 shadow-sm d-flex align-items-start gap-3 p-3 mb-4" role="alert">
                  <i className="bi bi-shield-lock-fill text-primary fs-4 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="h6 fw-bold mb-1 text-primary">Administrator Profile Governance Notice</h4>
                    <p className="small mb-0 text-secondary">
                      In accordance with platform security policy, Administrators are prohibited from modifying their own user profile, credentials, or agricultural parameters. Your account data can only be monitored by you; any profile updates must be conducted by another authorized Administrator via the Admin Console.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveProfile}>
                <div className="row g-3">
                  {/* Full Name */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-name">
                      {t('profile.fullName')} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="profile-name"
                      name="name"
                      type="text"
                      className="form-control"
                      value={form.name}
                      onChange={handleChange}
                      maxLength={50}
                      disabled={isAdmin || saving}
                      required
                    />
                  </div>

                  {/* Email Address (Read-only) */}
                  <div className="col-12 col-md-6">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label small fw-semibold mb-0" htmlFor="profile-email">
                        {t('auth.emailLabel')}
                      </label>
                      {user?.emailVerified ? (
                        <span className="badge bg-success-subtle text-success small" style={{ fontSize: '0.7rem' }}>
                          {t('profile.verifiedBadge')}
                        </span>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning-emphasis small" style={{ fontSize: '0.7rem' }}>
                          {t('profile.unverifiedBadge')}
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
                      {t('profile.phone')}
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
                        disabled={isAdmin || saving}
                      />
                    </div>
                  </div>

                  {/* Farm Name */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-farm-name">
                      {t('profile.farmName')}
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
                        disabled={isAdmin || saving}
                      />
                    </div>
                  </div>

                  {/* Farm Size */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-farm-size">
                      {t('profile.farmSize')}
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
                        disabled={isAdmin || saving}
                      />
                      <span className="input-group-text bg-light text-muted">{t('farms.hectares')}</span>
                    </div>
                  </div>

                  {/* Account Role (Readonly) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="profile-role">
                      {t('common.role')}
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
                      {t('profile.address')}
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
                      disabled={isAdmin || saving}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-2 border-top d-flex justify-content-end gap-2">
                  {isAdmin ? (
                    <button
                      type="button"
                      className="btn btn-secondary px-4 fw-semibold"
                      disabled
                      title="Self-modification is restricted for Administrators"
                    >
                      <i className="bi bi-lock me-1" />
                      Profile Locked (Admin Protected)
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn btn-primary px-4 fw-semibold"
                      disabled={saving}
                    >
                      {saving ? (
                        <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />{t('common.saving')}</>
                      ) : (
                        <>
                          <i className="bi bi-check2 me-1" />
                          {t('common.save')}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Danger Zone: Permanent Account Deletion */}
          <div className="card shadow-sm border-danger border-opacity-25 rounded-3 mt-4 overflow-hidden">
            <div className="card-header bg-danger bg-opacity-10 border-danger border-opacity-25 py-3 px-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2 text-danger">
                <i className="bi bi-exclamation-triangle-fill fs-5" />
                <h3 className="h6 fw-bold mb-0 text-danger">Danger Zone: Permanent Account Deletion</h3>
              </div>
              <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                Irreversible Action
              </span>
            </div>
            <div className="card-body p-4">
              <p className="text-secondary small mb-3">
                Deleting your account is permanent and cannot be undone. When you confirm deletion, your account and <strong>all associated data</strong> will be permanently wiped immediately:
              </p>
              <ul className="text-muted small mb-4 ps-3">
                <li>Your user profile, settings, and authentication credentials.</li>
                <li>All registered farms, field boundary maps, and soil records.</li>
                <li>Crop cycles, growth telemetry, and agricultural tasks.</li>
                <li>All uploaded field photographs from local and cloud storage.</li>
                <li>Active sessions, tokens, financial transactions, and support queries.</li>
              </ul>

              {isAdmin && adminCount !== null && adminCount <= 1 ? (
                <div className="alert alert-warning border-0 rounded-3 d-flex align-items-start gap-3 p-3">
                  <i className="bi bi-shield-lock-fill text-warning fs-4 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="h6 fw-bold text-dark mb-1">Sole Administrator Protection Active</h4>
                    <p className="small text-secondary mb-0">
                      You are currently the only active administrator on the platform. System governance prevents deleting the last active administrator to avoid platform lockout. Another administrator must be appointed before this account can be deleted.
                    </p>
                  </div>
                </div>
              ) : !showDeleteConfirm ? (
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pt-2 border-top">
                  <div>
                    <div className="fw-semibold text-danger small">Delete this account permanently</div>
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                      Once deleted, you can register again in the future as a brand-new user.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm fw-semibold d-flex align-items-center gap-1"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setDeleteError('');
                    }}
                  >
                    <i className="bi bi-trash3-fill" />
                    Delete Account Permanently
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3">
                  <h4 className="h6 fw-bold text-danger mb-2 d-flex align-items-center gap-2">
                    <i className="bi bi-shield-exclamation" />
                    Security Reauthentication &amp; Confirmation
                  </h4>
                  <p className="small text-dark mb-3">
                    To prevent accidental or unauthorized deletion, please verify your identity and confirm this action.
                  </p>

                  {deleteError && (
                    <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
                      <div>{deleteError}</div>
                    </div>
                  )}

                  <form onSubmit={handleDeleteAccount}>
                    {!isGoogleOnly ? (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-dark" htmlFor="delete-account-password">
                          Current Account Password <span className="text-danger">*</span>
                        </label>
                        <input
                          id="delete-account-password"
                          type="password"
                          className="form-control form-control-sm"
                          placeholder="Enter your current password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          required
                          disabled={deleting}
                        />
                      </div>
                    ) : (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-dark" htmlFor="delete-account-email">
                          Confirm Google Account Email (<span className="text-primary">{user?.email}</span>) <span className="text-danger">*</span>
                        </label>
                        <input
                          id="delete-account-email"
                          type="email"
                          className="form-control form-control-sm"
                          placeholder={user?.email}
                          value={deleteConfirmEmail}
                          onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                          required
                          disabled={deleting}
                        />
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark" htmlFor="delete-confirm-phrase">
                        Type <span className="badge bg-danger text-white font-monospace">DELETE</span> to confirm permanent erasure: <span className="text-danger">*</span>
                      </label>
                      <input
                        id="delete-confirm-phrase"
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="DELETE"
                        value={deleteConfirmPhrase}
                        onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
                        required
                        disabled={deleting}
                      />
                    </div>

                    <div className="d-flex align-items-center justify-content-end gap-2 pt-2">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeletePassword('');
                          setDeleteConfirmPhrase('');
                          setDeleteConfirmEmail('');
                          setDeleteError('');
                        }}
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-danger btn-sm fw-semibold d-flex align-items-center gap-1"
                        disabled={
                          deleting ||
                          deleteConfirmPhrase.trim() !== 'DELETE' ||
                          (!isGoogleOnly && !deletePassword) ||
                          (isGoogleOnly && deleteConfirmEmail.trim().toLowerCase() !== user?.email?.toLowerCase())
                        }
                      >
                        {deleting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                            Deleting Everything Permanently…
                          </>
                        ) : (
                          <>
                            <i className="bi bi-trash3-fill me-1" />
                            Permanently Delete My Account &amp; Data
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
