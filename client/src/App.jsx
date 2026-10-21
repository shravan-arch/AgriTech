import { useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FarmDetailPage from './pages/FarmDetailPage.jsx';
import FarmsPage from './pages/FarmsPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/useAuth.js';

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
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const initials = user?.name
    ?.split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
          <div className="sidebar-section-label">Workspace</div>
          <nav className="sidebar-nav" aria-label="Workspace navigation">
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/dashboard" onClick={closeMenu}>
              <i className="bi bi-grid-1x2" aria-hidden="true" />Overview
            </NavLink>
            <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/farms" onClick={closeMenu}>
              <i className="bi bi-houses" aria-hidden="true" />My farms
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note"><i className="bi bi-shield-check" aria-hidden="true" /><span>Your records are private to your account.</span></div>
            <div className="sidebar-profile">
              <span className="avatar">{initials || 'F'}</span>
              <span className="profile-copy"><strong>{user?.name}</strong><small>Farmer account</small></span>
              <button className="icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={logout}>
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
            <span className="avatar avatar-small">{initials || 'F'}</span>
          </header>
          <main className="workspace-content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/farms" element={<ProtectedRoute><FarmsPage /></ProtectedRoute>} />
              <Route path="/farms/:farmId" element={<ProtectedRoute><FarmDetailPage /></ProtectedRoute>} />
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
          <Route path="/farms/*" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    )
  );
}

export default App;
