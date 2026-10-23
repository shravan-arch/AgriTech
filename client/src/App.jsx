import { useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FarmDetailPage from './pages/FarmDetailPage.jsx';
import FarmsPage from './pages/FarmsPage.jsx';
import OperationsPage from './pages/OperationsPage.jsx';
import MonitoringPage from './pages/MonitoringPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LanguageToggle from './components/LanguageToggle.jsx';
import { useAuth } from './context/useAuth.js';
import { useLanguage } from './context/useLanguage.js';

const HomePage = () => {
  return (
    <div className="public-page">
      <header className="public-header">
        <Link className="brand-mark" to="/" aria-label="AgriTech home">
          <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
          <span>Agri<span className="brand-accent">Tech</span></span>
        </Link>
        <nav className="public-actions" aria-label="Account">
          <Link className="public-login" to="/login">Sign in</Link>
          <Link className="btn btn-primary" to="/register">Create account</Link>
        </nav>
      </header>
      <main className="home-hero">
        <div className="home-copy">
          <span className="eyebrow"><span className="eyebrow-dot" />A better way to know your land</span>
          <h1>Your farm deserves a clear view.</h1>
          <p>Keep farms and fields organized in one thoughtful workspace. Your records are built from the information you provide.</p>
          <div className="home-actions">
            <Link className="btn btn-primary btn-lg" to="/register">Get started <i className="bi bi-arrow-right ms-2" aria-hidden="true" /></Link>
            <Link className="btn btn-outline-secondary btn-lg" to="/login">Sign in</Link>
          </div>
          <div className="home-note"><i className="bi bi-shield-check" aria-hidden="true" /><span>Private farm records, always in your control.</span></div>
        </div>
        <div className="home-art" aria-hidden="true">
          <div className="home-art-sun" />
          <div className="home-art-hill hill-back" />
          <div className="home-art-hill hill-middle" />
          <div className="home-art-hill hill-front" />
          <div className="home-art-path" />
          <span className="home-art-label"><i className="bi bi-geo-alt-fill" /> Your land, at a glance</span>
          <i className="bi bi-flower3 home-art-flower flower-a" />
          <i className="bi bi-flower3 home-art-flower flower-b" />
        </div>
      </main>
      <footer className="public-footer"><span>AgriTech</span><span>Farm records, kept simple.</span></footer>
    </div>
  );
};

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const initials = user?.name
    ?.split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const userRoleLabel = user?.role === 'admin'
    ? 'Administrator'
    : 'Farmer';

  return (
    isAuthenticated ? (
      <div className="workspace-shell">
        <button
          className={`sidebar-scrim ${menuOpen ? 'is-visible' : ''}`}
          type="button"
          aria-label="Close navigation"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMenu}
        />
        <aside className={`workspace-sidebar ${menuOpen ? 'is-open' : ''}`} id="workspace-navigation">
          <Link className="brand-mark sidebar-brand" to="/dashboard" onClick={closeMenu}>
            <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
            <span>Agri<span className="brand-accent">Tech</span></span>
          </Link>
          <div className="sidebar-section-label">{t('nav.workspace')}</div>
          <nav className="sidebar-nav" aria-label="Workspace navigation">
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/dashboard" onClick={closeMenu}>
              <i className="bi bi-grid-1x2" aria-hidden="true" />
              <span>{t('nav.overview')}</span>
            </NavLink>
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/farms" onClick={closeMenu}>
              <i className="bi bi-houses" aria-hidden="true" />
              <span>{t('nav.farms')}</span>
            </NavLink>
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/operations" onClick={closeMenu}>
              <i className="bi bi-calendar2-check" aria-hidden="true" />
              <span>{t('nav.operations')}</span>
            </NavLink>
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/monitoring" onClick={closeMenu}>
              <i className="bi bi-broadcast-pin" aria-hidden="true" />
              <span>{t('nav.monitoring')}</span>
            </NavLink>
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/inventory" onClick={closeMenu}>
              <i className="bi bi-boxes" aria-hidden="true" />
              <span>{t('nav.inventory')}</span>
            </NavLink>
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/analytics" onClick={closeMenu}>
              <i className="bi bi-graph-up" aria-hidden="true" />
              <span>{t('nav.analytics')}</span>
            </NavLink>
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/profile" onClick={closeMenu}>
              <i className="bi bi-person-circle" aria-hidden="true" />
              <span>{t('nav.profile')}</span>
              {user && !user.emailVerified && (
                <span className="badge bg-warning text-dark ms-auto" style={{ fontSize: '0.65rem' }}>{t('nav.verify')}</span>
              )}
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink className={({ isActive }) => `sidebar-link sidebar-link-admin${isActive ? ' active' : ''}`} to="/admin" onClick={closeMenu}>
                <i className="bi bi-shield-shaded" aria-hidden="true" />
                <span className="fw-semibold">{t('nav.admin')}</span>
                <span className="sidebar-role-badge ms-auto">ADMIN</span>
              </NavLink>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className="d-flex align-items-center justify-content-between mb-2 px-1">
              <span className="sidebar-lang-label">Language:</span>
              <LanguageToggle size="sm" />
            </div>
            <div className="sidebar-note"><i className="bi bi-shield-check" aria-hidden="true" /><span>{t('nav.privateNotice')}</span></div>
            <div className="sidebar-profile-wrap">
              <Link to="/profile" className="sidebar-profile text-decoration-none" onClick={closeMenu}>
                <span className="avatar">{initials || 'F'}</span>
                <span className="profile-copy">
                  <strong>{user?.name}</strong>
                  <small>{userRoleLabel} {t('nav.accountSuffix')}</small>
                </span>
              </Link>
              <button
                className="icon-button sidebar-logout-btn"
                type="button"
                aria-label="Sign out"
                title="Sign out"
                onClick={logout}
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="mobile-topbar">
            <button
              className="icon-button menu-toggle"
              type="button"
              aria-controls="workspace-navigation"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
            </button>
            <Link className="brand-mark" to="/dashboard">
              <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
              <span>Agri<span className="brand-accent">Tech</span></span>
            </Link>
            <Link to="/profile" className="avatar avatar-small text-decoration-none">{initials || 'F'}</Link>
          </header>
          <main className="workspace-content">
            {user && !user.emailVerified && (
              <div className="alert alert-warning border-0 rounded-3 shadow-sm d-flex align-items-center justify-content-between py-2 px-3 mb-4" role="alert">
                <div className="d-flex align-items-center gap-2 small">
                  <i className="bi bi-exclamation-triangle-fill text-warning flex-shrink-0" style={{ fontSize: '1.1rem' }} />
                  <span>
                    Your email address (<strong>{user.email}</strong>) is not verified. Complete verification to secure your farm account.
                  </span>
                </div>
                <Link to="/profile" className="btn btn-warning btn-sm fw-semibold text-dark text-nowrap ms-2">
                  Verify in Profile
                </Link>
              </div>
            )}
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/farms" element={<ProtectedRoute><FarmsPage /></ProtectedRoute>} />
              <Route path="/farms/:farmId" element={<ProtectedRoute><FarmDetailPage /></ProtectedRoute>} />
              <Route path="/operations" element={<ProtectedRoute><OperationsPage /></ProtectedRoute>} />
              <Route path="/monitoring" element={<ProtectedRoute><MonitoringPage /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    ) : (
      <div className="public-app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/farms/*" element={<Navigate to="/login" replace />} />
          <Route path="/operations" element={<Navigate to="/login" replace />} />
          <Route path="/monitoring" element={<Navigate to="/login" replace />} />
          <Route path="/inventory" element={<Navigate to="/login" replace />} />
          <Route path="/analytics" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    )
  );
}

export default App;
