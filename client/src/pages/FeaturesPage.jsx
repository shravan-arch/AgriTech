import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/useLanguage.js';
import LanguageToggle from '../components/LanguageToggle.jsx';
import SEO from '../components/SEO.jsx';

const FEATURE_LIST = [
  {
    slug: 'farm-management',
    id: 'farms',
    icon: 'bi-houses-fill',
    title: 'Multi-Farm & Parcel Management',
    tagline: 'Centralized Portfolio Architecture',
    badge: 'Owner-Isolated Vault',
    color: '#10b981',
    bg: '#ecfdf5',
    summary: 'Organize multiple agricultural holdings, land parcels, and production blocks under a unified management structure with strict private data isolation.',
    capabilities: [
      'Multi-farm portfolio overview with individual acreage rollups and regional location markers.',
      'Parcel-level zoning with primary crop tags, planting dates, and irrigation infrastructure categorization.',
      'Soil type profiling covering major Indian agricultural classifications: Alluvial, Black Cotton, Red Loam, Sandy Loam, and Clay.',
      'Enterprise-grade privacy model: every grower’s farm coordinates, ownership records, and operational journals are strictly isolated.'
    ],
    metric: 'Unlimited Farm & Parcel Zoning',
    routeTarget: '/farms'
  },
  {
    slug: 'field-mapping',
    id: 'mapping',
    icon: 'bi-geo-alt-fill',
    title: 'GPS Field Mapping & Area Measurement',
    tagline: 'Satellite Boundary GIS & Acreage Calculation',
    badge: 'Terra Draw & Leaflet GIS',
    color: '#059669',
    bg: '#ecfdf5',
    summary: 'Delineate high-precision field boundaries using interactive satellite imagery and polygon drawing tools with instantaneous metric calculations.',
    capabilities: [
      'Interactive polygon drawing and vertex editing tools directly on satellite or street maps.',
      'Automatic spatial calculations: instantaneous conversion between Acres, Hectares, Square Meters, and regional Bighas.',
      'Perimeter distance calculations and GPS coordinate vertex logging.',
      'Standard GeoJSON boundary export for drone mission planning, soil sampling grids, and agricultural subsidy documentation.'
    ],
    metric: 'Millimeter-Accurate GIS Polygons',
    routeTarget: '/mapping'
  },
  {
    slug: 'crop-operations',
    id: 'operations',
    icon: 'bi-calendar2-check-fill',
    title: 'Crop Lifecycle & Field Task Operations',
    tagline: 'Growth Stage Timelines & Operational Schedules',
    badge: 'Growth Stage Tracking',
    color: '#d97706',
    bg: '#fffbeb',
    summary: 'Coordinate seasonal field interventions from sowing to maturity with prioritized task queues and stage-by-stage growth timelines.',
    capabilities: [
      'Six-stage standardized growth timeline: Sowing, Vegetative, Flowering, Grain Filling, Maturity, and Harvest.',
      'Prioritized task management: schedule irrigation runs, fertilization, and spraying with Urgent, High, and Normal flags.',
      'Operator assignment and real-time completion checklists.',
      'Elapsed growth trackers: calculate exact days-since-sowing and projected harvest maturity dates.'
    ],
    metric: 'End-to-End Crop Cycles',
    routeTarget: '/operations'
  },
  {
    slug: 'weather-monitoring',
    id: 'monitoring',
    icon: 'bi-broadcast-pin',
    title: 'Weather Forecasts & IoT Sensor Telemetry',
    tagline: 'Microclimate Tracking & Soil Anomaly Detection',
    badge: 'Open-Meteo Integration',
    color: '#0284c7',
    bg: '#f0f9ff',
    summary: 'Protect crops from weather risks and optimize irrigation through localized meteorological forecasts and live IoT soil sensor telemetry.',
    capabilities: [
      'Hyper-local 7-day meteorological forecast feeds: temperature highs/lows, precipitation probabilities, wind speed, and humidity.',
      'Irrigation planning telemetry: anticipate precipitation windows to prevent nutrient leaching and optimize water usage.',
      'Soil moisture sensor monitoring: track volumetric moisture content against optimal threshold bands (40% - 80%).',
      'Configurable anomaly alerts: immediate status warnings when soil conditions deviate from safe parameters.'
    ],
    metric: '7-Day Precision Forecasts',
    routeTarget: '/monitoring'
  },
  {
    slug: 'resource-inventory',
    id: 'inventory',
    icon: 'bi-boxes',
    title: 'Agricultural Supplies & Input Inventory',
    tagline: 'Stock Monitoring & Replenishment Thresholds',
    badge: 'Stock Alert Engine',
    color: '#7c3aed',
    bg: '#f5f3ff',
    summary: 'Maintain total visibility over seeds, fertilizers, crop protection chemicals, and farm machinery with proactive low-stock warnings.',
    capabilities: [
      'Categorized input tracking: Seeds, Fertilizers, Crop Protection, and Farm Equipment.',
      'Reorder threshold alerts: automatic notifications when supplies dip below safety minimums.',
      'Unit cost accounting: record purchase costs to compute exact seasonal input expenditures.',
      'Verified supplier integrations & external purchase archives: store official supplier GST invoices for tax and audit compliance.'
    ],
    metric: 'Zero-Downtime Input Stock',
    routeTarget: '/inventory'
  }
];

export default function FeaturesPage() {
  const { featureSlug } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [activeSlug, setActiveSlug] = useState(featureSlug || 'all');

  useEffect(() => {
    if (featureSlug) {
      setActiveSlug(featureSlug);
      const element = document.getElementById(featureSlug);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      setActiveSlug('all');
    }
  }, [featureSlug]);

  const activeFeature = FEATURE_LIST.find((f) => f.slug === activeSlug);

  // Dynamic SEO metadata based on selected feature
  const pageTitle = activeFeature
    ? `${activeFeature.title} - AgriTech Smart Farming Features`
    : 'AgriTech Features - Smart Farm Management & Precision Agriculture Capabilities';

  const pageDescription = activeFeature
    ? `${activeFeature.summary} Learn how AgriTech empowers farmers with precision agricultural software.`
    : 'Explore AgriTech features: GPS field mapping, real-time IoT soil & weather telemetry, crop cycle tracking, farm operations, and agricultural input inventory.';

  const canonicalUrl = activeFeature
    ? `https://agritech-bay.vercel.app/features/${activeFeature.slug}`
    : 'https://agritech-bay.vercel.app/features';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': 'https://agritech-bay.vercel.app/'
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Features',
        'item': 'https://agritech-bay.vercel.app/features'
      },
      ...(activeFeature
        ? [
            {
              '@type': 'ListItem',
              'position': 3,
              'name': activeFeature.title,
              'item': `https://agritech-bay.vercel.app/features/${activeFeature.slug}`
            }
          ]
        : [])
    ]
  };

  return (
    <div className="landing-page-wrap">
      <SEO
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={canonicalUrl}
        robots="index, follow"
        schema={breadcrumbSchema}
      />

      {/* Header Navigation */}
      <header className="landing-navbar">
        <div className="landing-container d-flex align-items-center justify-content-between">
          <Link className="landing-brand" to="/" aria-label="AgriTech Home">
            <span className="brand-logo-glow">
              <svg viewBox="0 0 40 40" width="36" height="36" className="brand-svg-icon" aria-hidden="true">
                <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f291e" stroke="#10b981" strokeWidth="1.5" />
                <path d="M20 32 C20 24 19 18 16 13" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M19 21 C12 20 8 14 9 9 C14 9 18 13 19 21 Z" fill="#10b981" />
                <path d="M20 17 C26 14 31 17 31 22 C26 23 21 21 20 17 Z" fill="#34d399" />
                <circle cx="29" cy="11" r="3" fill="#f59e0b" />
                <circle cx="20" cy="31" r="1.8" fill="#10b981" />
              </svg>
            </span>
            <span className="brand-text">
              Agri<span className="brand-text-accent">Tech</span>
            </span>
          </Link>

          <nav className="landing-nav-links d-none d-md-flex align-items-center gap-4" aria-label="Features navigation">
            <Link to="/" className="landing-nav-link">Home</Link>
            <Link to="/features" className="landing-nav-link active fw-bold text-success">Features Guide</Link>
            <a href="/#intelligence" className="landing-nav-link">Intelligence</a>
            <a href="/#metrics" className="landing-nav-link">Impact</a>
          </nav>

          <div className="landing-nav-actions d-flex align-items-center gap-2 gap-sm-3">
            <LanguageToggle />
            <Link to="/login" className="btn btn-outline-success btn-sm landing-btn-login px-3">
              {t('landing.signIn')}
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm landing-btn-cta px-3 shadow-sm">
              <span>{t('landing.getStarted')}</span>
              <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-5 bg-light border-bottom">
        <div className="landing-container">
          <nav aria-label="Breadcrumbs" className="mb-3">
            <ol className="breadcrumb small mb-0">
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none text-muted">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/features" className="text-decoration-none text-muted">Features</Link></li>
              {activeFeature && <li className="breadcrumb-item active text-success fw-semibold" aria-current="page">{activeFeature.title}</li>}
            </ol>
          </nav>

          <div className="text-center max-w-750 mx-auto py-3">
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-1-5 rounded-pill small fw-semibold mb-3">
              Agricultural Engineering Platform
            </span>
            <h1 className="h2 fw-bold text-dark mb-3">
              Precision Agricultural Capabilities &amp; Smart Farming Features
            </h1>
            <p className="text-secondary lead fs-6">
              AgriTech integrates spatial GIS field mapping, live meteorological telemetry, stage-based crop scheduling, and farm resource inventory into a single private operational workspace.
            </p>

            {/* Feature Filter Pills */}
            <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 ${activeSlug === 'all' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setActiveSlug('all');
                  navigate('/features');
                }}
              >
                All Capabilities
              </button>
              {FEATURE_LIST.map((feat) => (
                <button
                  key={feat.slug}
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 ${activeSlug === feat.slug ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                  onClick={() => {
                    setActiveSlug(feat.slug);
                    navigate(`/features/${feat.slug}`);
                  }}
                >
                  <i className={`bi ${feat.icon} me-1`} />
                  {feat.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Deep Dive Sections */}
      <section className="py-5">
        <div className="landing-container">
          <div className="d-flex flex-column gap-5">
            {FEATURE_LIST.filter((f) => activeSlug === 'all' || activeSlug === f.slug).map((feature, idx) => (
              <article
                key={feature.slug}
                id={feature.slug}
                className="card border rounded-4 shadow-sm overflow-hidden p-4 p-md-5 bg-white"
              >
                <div className="row g-4 align-items-center">
                  <div className={`col-12 col-lg-7 ${idx % 2 === 1 && activeSlug === 'all' ? 'order-lg-2' : ''}`}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-light text-success border border-success border-opacity-25 px-2.5 py-1 rounded-pill small fw-semibold">
                        {feature.badge}
                      </span>
                      <span className="text-muted small fw-medium">• {feature.tagline}</span>
                    </div>

                    <h2 className="h3 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                        style={{ width: '42px', height: '42px', backgroundColor: feature.bg, color: feature.color }}
                      >
                        <i className={`bi ${feature.icon} fs-5`} aria-hidden="true" />
                      </span>
                      {feature.title}
                    </h2>

                    <p className="text-secondary mb-4 fs-6">
                      {feature.summary}
                    </p>

                    <h3 className="h6 fw-bold text-dark text-uppercase letter-spacing-1 mb-3">
                      Verified Platform Capabilities
                    </h3>

                    <ul className="list-unstyled d-flex flex-column gap-2.5 mb-4">
                      {feature.capabilities.map((cap, cIdx) => (
                        <li key={cIdx} className="d-flex align-items-start gap-2.5 text-secondary small">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-0.5" />
                          <span>{cap}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="d-flex flex-wrap align-items-center gap-3 pt-2">
                      <Link to="/register" className="btn btn-success px-4 py-2 fw-semibold">
                        Open Free Farm Account
                        <i className="bi bi-arrow-right ms-2" />
                      </Link>
                      <Link to="/login" className="btn btn-outline-secondary px-3 py-2 fw-semibold">
                        Farmer Sign In
                      </Link>
                    </div>
                  </div>

                  <div className={`col-12 col-lg-5 ${idx % 2 === 1 && activeSlug === 'all' ? 'order-lg-1' : ''}`}>
                    <div
                      className="p-4 rounded-4 border text-center h-100 d-flex flex-column justify-content-center align-items-center"
                      style={{ backgroundColor: feature.bg, borderColor: `${feature.color}30` }}
                    >
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center mb-3 shadow-sm bg-white"
                        style={{ width: '72px', height: '72px', color: feature.color }}
                      >
                        <i className={`bi ${feature.icon} fs-2`} />
                      </div>
                      <div className="fw-bold text-dark fs-5 mb-1">{feature.metric}</div>
                      <p className="small text-muted mb-3 max-w-320">
                        Configured and tested in AgriTech production workspace with multi-lingual support.
                      </p>
                      <span className="badge bg-white text-dark border px-3 py-1-5 rounded-pill small fw-semibold shadow-2xs">
                        Production Ready
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="landing-cta-section">
        <div className="landing-container">
          <div className="landing-cta-banner text-center">
            <h2 className="cta-banner-title mb-3">Begin Managing Your Agricultural Operations</h2>
            <p className="cta-banner-subtitle mx-auto mb-4">
              Join growers and farm managers using AgriTech for spatial field mapping, IoT soil telemetry, and precision growth cycles.
            </p>
            <div className="d-flex flex-wrap justify-content-center gap-3">
              <Link to="/register" className="btn btn-light btn-lg cta-banner-btn shadow">
                <span>Create Your Farm Account</span>
                <i className="bi bi-arrow-right ms-2" />
              </Link>
              <Link to="/login" className="btn btn-outline-light btn-lg">
                <span>Sign In to Existing Farm</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container py-5 border-top">
          <div className="row g-4">
            <div className="col-12 col-md-4">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="fw-bold text-dark fs-5">AgriTech</span>
              </div>
              <p className="text-secondary small mb-3">
                Smart agriculture and farm management platform. Helping growers optimize field boundaries, monitor soil moisture telemetry, and coordinate seasonal crop cycles.
              </p>
              <div className="d-flex align-items-center gap-1 text-secondary small">
                <span className="live-pulse-dot" style={{ width: '8px', height: '8px' }} />
                <span>Production v2.5 Active</span>
              </div>
            </div>

            <div className="col-6 col-md-4">
              <div className="fw-bold text-dark mb-3 small text-uppercase">Platform Capabilities</div>
              <ul className="list-unstyled d-flex flex-column gap-2 small">
                <li><Link to="/features/farm-management" className="text-decoration-none text-muted">Farm &amp; Parcel Management</Link></li>
                <li><Link to="/features/field-mapping" className="text-decoration-none text-muted">GPS Field Mapping</Link></li>
                <li><Link to="/features/crop-operations" className="text-decoration-none text-muted">Crop Cycle Operations</Link></li>
                <li><Link to="/features/weather-monitoring" className="text-decoration-none text-muted">Weather &amp; IoT Telemetry</Link></li>
                <li><Link to="/features/resource-inventory" className="text-decoration-none text-muted">Supplies &amp; Input Stock</Link></li>
              </ul>
            </div>

            <div className="col-6 col-md-4">
              <div className="fw-bold text-dark mb-3 small text-uppercase">Farm Access</div>
              <ul className="list-unstyled d-flex flex-column gap-2 small">
                <li><Link to="/login" className="text-decoration-none text-muted">Farmer Sign In</Link></li>
                <li><Link to="/register" className="text-decoration-none text-muted">Register New Farm</Link></li>
                <li><Link to="/features" className="text-decoration-none text-muted">Features Guide</Link></li>
                <li><Link to="/" className="text-decoration-none text-muted">AgriTech Home</Link></li>
              </ul>
            </div>
          </div>

          <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 pt-4 mt-4 border-top text-secondary small">
            <div>&copy; {new Date().getFullYear()} AgriTech. Precision Agriculture &amp; Farm Operations.</div>
            <div className="d-flex align-items-center gap-3">
              <span>Owner-Isolated Farm Vault</span>
              <span>•</span>
              <span>Multi-Regional Language Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
