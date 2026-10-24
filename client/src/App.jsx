import { useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
import AdminPage from './pages/AdminPage.jsx';
import LanguageToggle from './components/LanguageToggle.jsx';
import { useAuth } from './context/useAuth.js';
import { useLanguage } from './context/useLanguage.js';
import LandingPage from './pages/LandingPage.jsx';

const ADMIN_PAGES = [
  { id: 'overview', label: 'Overview', shortDesc: 'Platform KPIs & Activity', icon: 'bi-grid-1x2' },
  { id: 'users', label: 'Users', shortDesc: 'Profiles & Support', icon: 'bi-people' },
  { id: 'content', label: 'Content', shortDesc: 'Crops & Knowledge', icon: 'bi-journal-richtext' },
  { id: 'resources', label: 'Resources', shortDesc: 'Inventory & Stock Alerts', icon: 'bi-boxes' },
  { id: 'services', label: 'Services', shortDesc: 'Offerings & Bookings', icon: 'bi-calendar-check' },
  { id: 'analytics', label: 'Analytics', shortDesc: 'Reports & Strategic Trends', icon: 'bi-graph-up' },
  { id: 'security_policies', label: 'Security & Policies', shortDesc: 'Health, Audit & Compliance', icon: 'bi-shield-check' },
  { id: 'profile', label: 'My Profile', shortDesc: 'Admin Account & Security', icon: 'bi-person-circle' },
];

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  const initials = user?.name
    ?.split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isAdmin = user?.role === 'admin';

  // Extract active admin tab from query param
  const searchParams = new URLSearchParams(location.search);
  const currentAdminTab = searchParams.get('tab') || 'overview';

  // -------------------------------------------------------------------------
  // 1. AUTHENTICATED: ENTERPRISE ADMINISTRATOR ENVIRONMENT
  // -------------------------------------------------------------------------
  if (isAuthenticated && isAdmin) {
    return (
      <div className="admin-workspace-shell">
        {/* Mobile scrim overlay */}
        <button
          className={`admin-sidebar-scrim ${menuOpen ? 'is-visible' : ''}`}
          type="button"
          aria-label="Close admin navigation"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMenu}
        />

        {/* Dedicated Admin Sidebar (Green Brand Theme) */}
        <aside className={`admin-workspace-sidebar ${menuOpen ? 'is-open' : ''}`} id="admin-workspace-navigation">
          <Link className="brand-mark sidebar-brand" to="/admin?tab=overview" onClick={closeMenu}>
            <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
            <span style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, fontFamily: 'inherit' }}>AgriTech</span>
          </Link>

          <div className="farmbrite-farm-pill mb-3">
            <span className="farm-pill-dot" style={{ backgroundColor: '#22c55e' }} />
            <div className="farm-pill-text">
              <strong>AgriTech Admin Console Platform</strong>
              <small>Governance Active</small>
            </div>
          </div>

          <div className="admin-sidebar-section-label">ADMINISTRATION</div>

          <nav className="admin-sidebar-nav" aria-label="Admin domain navigation">
            {ADMIN_PAGES.map((page) => {
              const isActive = location.pathname === '/admin' && currentAdminTab === page.id;
              return (
                <button
                  key={page.id}
                  type="button"
                  className={`admin-sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    navigate(`/admin?tab=${page.id}`);
                    closeMenu();
                  }}
                >
                  <div className="admin-link-icon-wrap">
                    <i className={`bi ${page.icon}`} aria-hidden="true" />
                  </div>
                  <div className="admin-link-content">
                    <span className="admin-link-title">{page.label}</span>
                    <span className="admin-link-subtext">{page.shortDesc}</span>
                  </div>
                  {isActive && <i className="bi bi-chevron-right ms-auto admin-active-chevron" />}
                </button>
              );
            })}
          </nav>

          <div className="admin-sidebar-bottom">
            <div className="admin-guard-note">
              <i className="bi bi-shield-check text-success flex-shrink-0" />
              <div>
                <strong className="d-block text-white">Platform Administrator</strong>
                <span style={{ fontSize: '0.68rem', color: '#a3c2a6' }}>User workspace isolated</span>
              </div>
            </div>

            <div className="admin-profile-card">
              <button
                type="button"
                className="d-flex align-items-center gap-2 border-0 bg-transparent text-start p-0 flex-grow-1 text-decoration-none"
                onClick={() => {
                  navigate('/admin?tab=profile');
                  closeMenu();
                }}
                title="View Admin Profile"
              >
                <div className="admin-avatar">
                  {initials || 'AD'}
                </div>
                <div className="admin-profile-details">
                  <span className="admin-name" title={user?.name}>{user?.name}</span>
                  <span className="admin-email" title={user?.email}>{user?.email}</span>
                </div>
              </button>
              <button
                className="admin-logout-btn"
                type="button"
                aria-label="Sign out"
                title="Sign out of Admin Environment"
                onClick={logout}
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>

        {/* Admin Main Workspace */}
        <div className="admin-workspace-main">
          <header className="admin-workspace-topbar">
            <div className="d-flex align-items-center gap-3">
              <button
                className="admin-menu-toggle d-lg-none"
                type="button"
                aria-label="Toggle admin navigation"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
              </button>

              <Link className="brand-mark d-md-none" to="/admin?tab=overview">
                <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
                <span>Agri<span className="brand-accent">Tech</span></span>
              </Link>

              <div className="d-none d-md-flex align-items-center gap-2">
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-1-5 small fw-semibold d-inline-flex align-items-center gap-2">
                  <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '0.5rem', height: '0.5rem' }} role="status" aria-hidden="true" />
                  AgriTech Intelligence Hub &bull; Administrator
                </span>
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-1 small d-none d-lg-inline-flex align-items-center gap-1">
                  <i className="bi bi-check-circle-fill" /> All 8 Systems Active
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              <LanguageToggle />
              <div className="d-none d-sm-flex align-items-center gap-2 text-muted small">
                <i className="bi bi-shield-lock-fill text-success" />
                <span>Authorized Admin</span>
              </div>
              <button
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2"
                onClick={logout}
                title="Sign out of Admin Console"
              >
                <i className="bi bi-box-arrow-right" />
                <span className="d-none d-md-inline">Sign Out</span>
              </button>
            </div>
          </header>

          <main className="admin-workspace-content">
            <Routes>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
              {/* User features are terminated for admins: redirect all user pages to /admin */}
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. AUTHENTICATED: FARMER / USER WORKSPACE
  // -------------------------------------------------------------------------
  if (isAuthenticated && !isAdmin) {
    return (
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
            <span style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, fontFamily: 'inherit' }}>AgriTech</span>
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
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note"><i className="bi bi-shield-check" aria-hidden="true" /><span>{t('nav.privateNotice')}</span></div>
            <div className="sidebar-profile-wrap">
              <Link to="/profile" className="sidebar-profile text-decoration-none" onClick={closeMenu}>
                <span className="avatar">{initials || 'F'}</span>
                <span className="profile-copy">
                  <strong>{user?.name}</strong>
                  <small>Farmer {t('nav.accountSuffix')}</small>
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
          <header className="workspace-topbar">
            <div className="d-flex align-items-center gap-3">
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
              <Link className="brand-mark d-md-none" to="/dashboard">
                <span className="brand-icon"><i className="bi bi-flower1" aria-hidden="true" /></span>
                <span>Agri<span className="brand-accent">Tech</span></span>
              </Link>
              <div className="d-none d-md-flex align-items-center gap-2">
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-1-5 small fw-semibold d-inline-flex align-items-center gap-2">
                  <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '0.5rem', height: '0.5rem' }} role="status" aria-hidden="true" />
                  AgriTech Intelligence Hub
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              <LanguageToggle />
              <Link to="/profile" className="avatar avatar-small text-decoration-none" title="User Profile">
                {initials || 'F'}
              </Link>
            </div>
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
              {/* Farmers cannot access /admin - redirect to dashboard */}
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 3. UNAUTHENTICATED: PUBLIC APPLICATION
  // -------------------------------------------------------------------------
  return (
    <div className="public-app">
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
        <Route path="/admin" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
