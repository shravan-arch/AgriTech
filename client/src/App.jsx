import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';

function App() {
  const { user, isAuthenticated, login, register, logout } = useAuth();

  const [healthStatus, setHealthStatus] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState(null);

  // Auth UI state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    farmName: '',
    farmSizeHectares: 10,
    primaryCrops: 'Wheat, Mustard, Barley'
  });

  const checkHealth = async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      console.warn('Backend connection error:', err.message);
      setHealthError(err.message);
      setHealthStatus(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleFormChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        await login(formData.email, formData.password);
      } else {
        const cropsArray = formData.primaryCrops
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);

        await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          farmName: formData.farmName || 'My Family Farm',
          farmSizeHectares: Number(formData.farmSizeHectares) || 10,
          primaryCrops: cropsArray
        });
      }
      setShowAuthModal(false);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setAuthMode('login');
    setFormData((prev) => ({
      ...prev,
      email: 'demo@agritech.com',
      password: 'Farmer123!'
    }));
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navigation */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top shadow-sm py-3">
        <div className="container">
          <a className="navbar-brand d-flex align-items-center fw-bold fs-4" href="#!">
            <i className="bi bi-flower1 text-success me-2 fs-3"></i>
            Agri<span className="text-success">Tech</span>
          </a>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navContent"
            aria-controls="navContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navContent">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-2">
              <li className="nav-item">
                <a className="nav-link active" href="#overview">Overview</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#features">Features</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#status">Backend Status</a>
              </li>

              {/* API Health Pill */}
              <li className="nav-item">
                <button
                  onClick={checkHealth}
                  className={`btn btn-sm ${healthStatus ? 'btn-outline-success' : 'btn-outline-warning'} d-flex align-items-center gap-2`}
                  title="Click to re-ping API"
                >
                  <span className={healthStatus ? 'badge-live-pulse' : ''}></span>
                  <i className="bi bi-broadcast"></i>
                  {loadingHealth ? 'Pinging...' : healthStatus ? 'API Online' : 'Check API'}
                </button>
              </li>

              {/* User / Auth Controls */}
              {isAuthenticated ? (
                <li className="nav-item dropdown ms-lg-2">
                  <div className="d-flex align-items-center gap-2 bg-secondary bg-opacity-25 px-3 py-1 rounded-pill">
                    <i className="bi bi-person-circle text-success fs-5"></i>
                    <span className="text-light small fw-semibold">{user.name}</span>
                    <button
                      onClick={logout}
                      className="btn btn-sm btn-outline-danger py-0 px-2 rounded-pill ms-2"
                      title="Log Out"
                    >
                      <i className="bi bi-box-arrow-right"></i>
                    </button>
                  </div>
                </li>
              ) : (
                <li className="nav-item ms-lg-2">
                  <button
                    onClick={() => {
                      setAuthError('');
                      setShowAuthModal(true);
                    }}
                    className="btn btn-success btn-sm px-3 rounded-pill fw-semibold"
                  >
                    <i className="bi bi-person-fill me-1"></i> Farmer Portal
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>

      {/* Authenticated Farmer Dashboard Banner (Shown when logged in) */}
      {isAuthenticated && (
        <section className="bg-success text-white py-3 border-bottom shadow-sm">
          <div className="container d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
            <div>
              <span className="badge bg-light text-success fw-bold me-2">ACTIVE SESSION</span>
              <strong>{user.farmName || 'Farm Portal'}</strong> &bull; Role: <span className="text-capitalize">{user.role}</span> &bull; {user.email}
            </div>
            <div className="d-flex gap-2 align-items-center">
              <span className="badge bg-dark bg-opacity-50">
                <i className="bi bi-shield-check me-1"></i> JWT Authenticated
              </span>
              <button onClick={logout} className="btn btn-light btn-sm fw-semibold text-success">
                Sign Out
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Hero Banner */}
      <header id="overview" className="container my-4">
        <div className="hero-banner p-4 p-md-5 text-center text-md-start shadow-sm">
          <div className="row align-items-center">
            <div className="col-lg-8">
              <div className="badge bg-light text-success fw-semibold px-3 py-2 rounded-pill mb-3">
                <i className="bi bi-check-circle-fill me-1"></i> Milestone 1 & 2 Completed: Scaffold + Auth Ready
              </div>
              <h1 className="display-4 fw-bold mb-3">
                Smart Farming Intelligence & Analytics
              </h1>
              <p className="lead text-light opacity-90 mb-4">
                Empowering farmers and agronomists with data-driven insights, soil health monitoring,
                smart crop scheduling, and yield forecasting on an integrated full-stack platform.
              </p>
              <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-md-start">
                {!isAuthenticated ? (
                  <button
                    onClick={() => {
                      fillDemoCredentials();
                      setShowAuthModal(true);
                    }}
                    className="btn btn-warning btn-lg fw-bold px-4 text-dark shadow-sm"
                  >
                    <i className="bi bi-lightning-charge-fill me-2"></i> Launch Demo Farmer
                  </button>
                ) : (
                  <a href="#features" className="btn btn-warning btn-lg fw-bold px-4 text-dark shadow-sm">
                    <i className="bi bi-speedometer2 me-2"></i> Open Dashboard
                  </a>
                )}
                <a href="#status" className="btn btn-outline-light btn-lg px-4">
                  <i className="bi bi-activity me-2"></i> Inspect Backend Health
                </a>
              </div>
            </div>
            <div className="col-lg-4 d-none d-lg-block text-center">
              <i className="bi bi-tree text-white opacity-25" style={{ fontSize: '11rem' }}></i>
            </div>
          </div>
        </div>
      </header>

      {/* Live Server Health Status Section */}
      <section id="status" className="container mb-5">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold d-flex align-items-center text-dark">
              <i className="bi bi-hdd-network text-primary me-2"></i> Backend Connectivity & Diagnostics
            </h5>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={checkHealth}
              disabled={loadingHealth}
            >
              <i className={`bi bi-arrow-clockwise me-1 ${loadingHealth ? 'spin' : ''}`}></i>
              {loadingHealth ? 'Pinging...' : 'Refresh'}
            </button>
          </div>
          <div className="card-body">
            {loadingHealth && !healthStatus && (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border text-success mb-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mb-0">Connecting to Express API at <code>/api/health</code>...</p>
              </div>
            )}

            {healthStatus && (
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="p-3 bg-light rounded border text-center">
                    <div className="text-muted small">Status</div>
                    <div className="fs-5 fw-bold text-success text-capitalize">
                      <i className="bi bi-check-circle me-1"></i>
                      {healthStatus.status}
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-3 bg-light rounded border text-center">
                    <div className="text-muted small">Database Status</div>
                    <div className="fs-5 fw-bold text-primary text-truncate" title={healthStatus.database?.mode}>
                      {healthStatus.database?.connected ? 'Atlas Connected' : 'Dev Fallback'}
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-3 bg-light rounded border text-center">
                    <div className="text-muted small">Server Uptime</div>
                    <div className="fs-5 fw-bold text-dark">
                      {Math.round(healthStatus.uptime)}s
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-3 bg-light rounded border text-center">
                    <div className="text-muted small">Auth Service</div>
                    <div className="fs-5 fw-bold text-success text-capitalize">
                      <i className="bi bi-lock-fill me-1"></i>
                      {healthStatus.services?.auth || 'Active'}
                    </div>
                  </div>
                </div>
                <div className="col-12 mt-3">
                  <div className="alert alert-success d-flex align-items-center mb-0" role="alert">
                    <i className="bi bi-shield-check fs-4 me-2"></i>
                    <div>
                      <strong>Full-stack handshake verified:</strong> {healthStatus.message} (Database Mode: <code>{healthStatus.database?.mode}</code>)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {healthError && (
              <div className="alert alert-warning mb-0" role="alert">
                <h6 className="alert-heading fw-bold mb-1">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i> Express Server Not Detected
                </h6>
                <p className="mb-2 small">
                  The frontend is running, but could not connect to <code>http://localhost:5000/api/health</code>.
                </p>
                <div className="bg-dark text-light p-2 rounded small font-monospace">
                  npm run server
                </div>
                <small className="text-muted d-block mt-2">
                  Details: {healthError}
                </small>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Core Platform Modules */}
      <section id="features" className="container mb-5">
        <div className="text-center mb-4">
          <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill fw-semibold">
            Capabilities
          </span>
          <h2 className="fw-bold mt-2">AgriTech Core Modules</h2>
          <p className="text-muted">Designed for high-throughput farm monitoring and resource optimization</p>
        </div>

        <div className="row g-4">
          <div className="col-md-6 col-lg-3">
            <div className="card h-100 feature-card shadow-sm p-3">
              <div className="card-body">
                <div className="bg-success text-white rounded-3 d-inline-flex p-3 mb-3">
                  <i className="bi bi-moisture fs-3"></i>
                </div>
                <h5 className="card-title fw-bold">Soil & Irrigation</h5>
                <p className="card-text text-muted small">
                  Continuous sensor ingestion for moisture levels, nitrogen balance, and automated valve control.
                </p>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card h-100 feature-card shadow-sm p-3">
              <div className="card-body">
                <div className="bg-primary text-white rounded-3 d-inline-flex p-3 mb-3">
                  <i className="bi bi-cloud-sun fs-3"></i>
                </div>
                <h5 className="card-title fw-bold">Weather Intelligence</h5>
                <p className="card-text text-muted small">
                  Localized micro-climate forecasts, frost alerts, and precipitation predictions to plan planting cycles.
                </p>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card h-100 feature-card shadow-sm p-3">
              <div className="card-body">
                <div className="bg-warning text-dark rounded-3 d-inline-flex p-3 mb-3">
                  <i className="bi bi-graph-up-arrow fs-3"></i>
                </div>
                <h5 className="card-title fw-bold">Yield Forecasting</h5>
                <p className="card-text text-muted small">
                  Interactive Recharts dashboards visualizing historical yields, crop performance, and harvest estimates.
                </p>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card h-100 feature-card shadow-sm p-3">
              <div className="card-body">
                <div className="bg-danger text-white rounded-3 d-inline-flex p-3 mb-3">
                  <i className="bi bi-shield-lock fs-3"></i>
                </div>
                <h5 className="card-title fw-bold">JWT Security</h5>
                <p className="card-text text-muted small">
                  Bcrypt hashed credentials, role-based controls (Farmer, Agronomist, Admin), and token verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Verification */}
      <section id="stack" className="container mb-5">
        <div className="card bg-light border-0 p-4 shadow-sm">
          <h4 className="fw-bold mb-3 d-flex align-items-center">
            <i className="bi bi-layers-fill text-success me-2"></i> Verified Architecture Stack
          </h4>
          <div className="row g-3">
            <div className="col-sm-6 col-lg-3">
              <div className="p-3 bg-white rounded border">
                <div className="fw-bold text-dark">Frontend</div>
                <div className="small text-muted">React (Vite) + JS + Context API</div>
                <span className="badge bg-success mt-2">Verified</span>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="p-3 bg-white rounded border">
                <div className="fw-bold text-dark">Styling & UI</div>
                <div className="small text-muted">Bootstrap 5 + Icons</div>
                <span className="badge bg-success mt-2">Verified</span>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="p-3 bg-white rounded border">
                <div className="fw-bold text-dark">Backend API</div>
                <div className="small text-muted">Node.js + Express 4 REST</div>
                <span className="badge bg-success mt-2">Verified</span>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="p-3 bg-white rounded border">
                <div className="fw-bold text-dark">Database & Auth</div>
                <div className="small text-muted">MongoDB Mongoose + JWT + Bcrypt</div>
                <span className="badge bg-success mt-2">Verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      {showAuthModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          tabIndex="-1"
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-person-circle text-success me-2"></i>
                  {authMode === 'login' ? 'Farmer Sign In' : 'Create Farm Account'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAuthModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-4">
                {authError && (
                  <div className="alert alert-danger py-2 small" role="alert">
                    <i className="bi bi-exclamation-circle me-1"></i> {authError}
                  </div>
                )}

                <div className="d-flex justify-content-between mb-3 border-bottom pb-2">
                  <button
                    type="button"
                    className={`btn btn-sm ${authMode === 'login' ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${authMode === 'register' ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                    }}
                  >
                    Register New Farm
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-warning"
                    onClick={fillDemoCredentials}
                  >
                    Demo Farmer
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit}>
                  {authMode === 'register' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Farmer Full Name</label>
                        <input
                          type="text"
                          name="name"
                          className="form-control"
                          value={formData.name}
                          onChange={handleFormChange}
                          required
                          placeholder="e.g. Ramesh Patel"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Farm Name</label>
                        <input
                          type="text"
                          name="farmName"
                          className="form-control"
                          value={formData.farmName}
                          onChange={handleFormChange}
                          placeholder="e.g. Green Valley Farm"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Primary Crops</label>
                        <input
                          type="text"
                          name="primaryCrops"
                          className="form-control"
                          value={formData.primaryCrops}
                          onChange={handleFormChange}
                          placeholder="e.g. Wheat, Rice, Cotton"
                        />
                      </div>
                    </>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={formData.email}
                      onChange={handleFormChange}
                      required
                      placeholder="farmer@agritech.com"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Password</label>
                    <input
                      type="password"
                      name="password"
                      className="form-control"
                      value={formData.password}
                      onChange={handleFormChange}
                      required
                      minLength="6"
                      placeholder="Minimum 6 characters"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success w-100 fw-bold py-2 mt-2"
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <span>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Processing...
                      </span>
                    ) : authMode === 'login' ? (
                      'Sign In to Farm Portal'
                    ) : (
                      'Register Farm Account'
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto bg-dark text-light py-4 border-top">
        <div className="container text-center text-md-between d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
          <div className="small text-muted">
            &copy; {new Date().getFullYear()} AgriTech Platform &bull; Milestone 1 & 2 Completed.
          </div>
          <div className="d-flex gap-3 small">
            <a href="#overview" className="text-secondary text-decoration-none">Top</a>
            <a href="#status" className="text-secondary text-decoration-none">Health Status</a>
            <span className="text-secondary">|</span>
            <span className="text-success"><i className="bi bi-circle-fill me-1 small"></i> Node v24</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
