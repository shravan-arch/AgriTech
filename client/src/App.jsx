import React, { useState, useEffect } from 'react';

function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      // In dev, Vite proxies /api to http://localhost:5000
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      console.warn('Backend connection error:', err.message);
      setError(err.message);
      setHealthStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

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
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
              <li className="nav-item">
                <a className="nav-link active" href="#overview">Overview</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#features">Features</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#status">Backend Status</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#stack">Stack</a>
              </li>
              <li className="nav-item ms-lg-3 mt-2 mt-lg-0">
                <button
                  onClick={checkHealth}
                  className={`btn btn-sm ${healthStatus ? 'btn-outline-success' : 'btn-outline-warning'} d-flex align-items-center gap-2`}
                  title="Click to re-ping API"
                >
                  <span className={healthStatus ? 'badge-live-pulse' : ''}></span>
                  <i className="bi bi-broadcast"></i>
                  {loading ? 'Checking...' : healthStatus ? 'API Online' : 'Check API'}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero Banner */}
      <header id="overview" className="container my-4">
        <div className="hero-banner p-4 p-md-5 text-center text-md-start shadow-sm">
          <div className="row align-items-center">
            <div className="col-lg-8">
              <div className="badge bg-light text-success fw-semibold px-3 py-2 rounded-pill mb-3">
                <i className="bi bi-check-circle-fill me-1"></i> Milestone 1: Working Scaffold Ready
              </div>
              <h1 className="display-4 fw-bold mb-3">
                Smart Farming Intelligence & Analytics
              </h1>
              <p className="lead text-light opacity-90 mb-4">
                Empowering farmers and agronomists with data-driven insights, soil health monitoring,
                smart crop scheduling, and yield forecasting on an integrated full-stack platform.
              </p>
              <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-md-start">
                <a href="#status" className="btn btn-warning btn-lg fw-bold px-4 text-dark shadow-sm">
                  <i className="bi bi-cpu me-2"></i> Inspect API Health
                </a>
                <a href="#features" className="btn btn-outline-light btn-lg px-4">
                  <i className="bi bi-compass me-2"></i> Explore Features
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
              disabled={loading}
            >
              <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
              {loading ? 'Pinging...' : 'Refresh'}
            </button>
          </div>
          <div className="card-body">
            {loading && !healthStatus && (
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
                    <div className="text-muted small">Environment</div>
                    <div className="fs-5 fw-bold text-dark text-uppercase">
                      {healthStatus.environment}
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-3 bg-light rounded border text-center">
                    <div className="text-muted small">Server Uptime</div>
                    <div className="fs-5 fw-bold text-primary">
                      {Math.round(healthStatus.uptime)}s
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="p-3 bg-light rounded border text-center">
                    <div className="text-muted small">Timestamp</div>
                    <div className="small fw-semibold text-truncate" title={healthStatus.timestamp}>
                      {new Date(healthStatus.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="col-12 mt-3">
                  <div className="alert alert-success d-flex align-items-center mb-0" role="alert">
                    <i className="bi bi-shield-check fs-4 me-2"></i>
                    <div>
                      <strong>Full-stack handshake verified:</strong> {healthStatus.message}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="alert alert-warning mb-0" role="alert">
                <h6 className="alert-heading fw-bold mb-1">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i> Express Server Not Detected Yet
                </h6>
                <p className="mb-2 small">
                  The frontend is running, but could not connect to <code>http://localhost:5000/api/health</code>.
                </p>
                <div className="bg-dark text-light p-2 rounded small font-monospace">
                  npm run server
                </div>
                <small className="text-muted d-block mt-2">
                  Error details: {error}
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
                <h5 className="card-title fw-bold">Secure Access</h5>
                <p className="card-text text-muted small">
                  Multi-tenant farm security with JWT authorization, role-based controls, and encrypted credentials.
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
                <div className="small text-muted">React (Vite) + JavaScript</div>
                <span className="badge bg-success mt-2">Configured</span>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="p-3 bg-white rounded border">
                <div className="fw-bold text-dark">Styling & UI</div>
                <div className="small text-muted">Bootstrap 5 + Icons</div>
                <span className="badge bg-success mt-2">Configured</span>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="p-3 bg-white rounded border">
                <div className="fw-bold text-dark">Backend API</div>
                <div className="small text-muted">Node.js + Express REST</div>
                <span className="badge bg-success mt-2">Configured</span>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="p-3 bg-white rounded border">
                <div className="fw-bold text-dark">Database & Auth</div>
                <div className="small text-muted">MongoDB Atlas + JWT/Bcrypt</div>
                <span className="badge bg-primary mt-2">Ready for M2</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-dark text-light py-4 border-top">
        <div className="container text-center text-md-between d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
          <div className="small text-muted">
            &copy; {new Date().getFullYear()} AgriTech Platform. Milestone 1 - Scaffold & Health Check Verified.
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
