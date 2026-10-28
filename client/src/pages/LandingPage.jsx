import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/useLanguage.js';
import LanguageToggle from '../components/LanguageToggle.jsx';
import SEO from '../components/SEO.jsx';

const SLIDES = [
  {
    id: 'drone-field',
    image: '/images/smart-drone-field.jpg',
    titleKey: 'landing.slide1Title',
    subtitleKey: 'landing.slide1Subtitle',
    tag: 'Drone Aerial Scouting',
    badgeText: 'Live Telemetry Active',
    badgeIcon: 'bi-broadcast-pin',
    metric: '98.4% Spatial Accuracy',
  },
  {
    id: 'wheat-sunset',
    image: '/images/golden-wheat-sunset.jpg',
    titleKey: 'landing.slide2Title',
    subtitleKey: 'landing.slide2Subtitle',
    tag: 'Yield Forecasting',
    badgeText: 'Harvest Ready',
    badgeIcon: 'bi-graph-up-arrow',
    metric: '+24% YoY Yield Boost',
  },
  {
    id: 'greenhouse-iot',
    image: '/images/smart-greenhouse-iot.jpg',
    titleKey: 'landing.slide3Title',
    subtitleKey: 'landing.slide3Subtitle',
    tag: 'Precision Hydroponics & IoT',
    badgeText: 'Micro-Climate Control',
    badgeIcon: 'bi-cpu',
    metric: '68% Soil Moisture Optimal',
  },
];

const FEATURES = [
  {
    slug: 'field-mapping',
    icon: 'bi-geo-alt-fill',
    titleKey: 'landing.feature1Title',
    descKey: 'landing.feature1Desc',
    color: '#10b981',
    bg: '#ecfdf5',
    metricBadge: 'GPS Boundaries',
  },
  {
    slug: 'weather-monitoring',
    icon: 'bi-cpu-fill',
    titleKey: 'landing.feature2Title',
    descKey: 'landing.feature2Desc',
    color: '#06b6d4',
    bg: '#ecfeff',
    metricBadge: 'Real-time Feeds',
  },
  {
    slug: 'crop-operations',
    icon: 'bi-calendar2-check-fill',
    titleKey: 'landing.feature3Title',
    descKey: 'landing.feature3Desc',
    color: '#f59e0b',
    bg: '#fffbeb',
    metricBadge: 'Growth Stages',
  },
  {
    slug: 'resource-inventory',
    icon: 'bi-boxes',
    titleKey: 'landing.feature4Title',
    descKey: 'landing.feature4Desc',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    metricBadge: 'Low-Stock Alerts',
  },
  {
    slug: 'farm-management',
    icon: 'bi-cash-coin',
    titleKey: 'landing.feature5Title',
    descKey: 'landing.feature5Desc',
    color: '#16a34a',
    bg: '#f0fdf4',
    metricBadge: 'MSP Benchmarks',
  },
  {
    slug: 'farm-management',
    icon: 'bi-shield-check',
    titleKey: 'landing.feature6Title',
    descKey: 'landing.feature6Desc',
    color: '#3b82f6',
    bg: '#eff6ff',
    metricBadge: 'Owner-Isolated Vault',
  },
];

const STATS = [
  { value: '99.8%', labelKey: 'landing.statUptime', icon: 'bi-activity' },
  { value: '4,200+', labelKey: 'landing.statAcres', icon: 'bi-bounding-box-circles' },
  { value: '+24%', labelKey: 'landing.statYield', icon: 'bi-arrow-up-right-circle' },
  { value: '1,250+', labelKey: 'landing.statFarmers', icon: 'bi-people-fill' },
];

export default function LandingPage() {
  const { t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState('telemetry');
  const timerRef = useRef(null);

  // Auto-advance slideshow
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, currentSlide]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  return (
    <div className="landing-page-wrap">
      <SEO
        title="AgriTech - Smart Farm Management & Precision Agriculture Software"
        description="AgriTech is an all-in-one farm management platform offering GPS field boundary mapping, real-time IoT soil & weather telemetry, crop lifecycle scheduling, and farm supply inventory in a private workspace."
        canonicalUrl="https://agritech-bay.vercel.app/"
        robots="index, follow"
      />

      {/* Animated Top Navigation Bar */}
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

          <nav className="landing-nav-links d-none d-md-flex align-items-center gap-4" aria-label="Page Sections">
            <a href="#features" className="landing-nav-link">{t('landing.explorePlatform')}</a>
            <Link to="/features" className="landing-nav-link">{t('landing.featuresGuide')}</Link>
            <a href="#intelligence" className="landing-nav-link">{t('landing.intelligenceNav')}</a>
            <a href="#metrics" className="landing-nav-link">{t('landing.impactNav')}</a>
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 rounded-pill small">
              v2.5 Live
            </span>
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
      <section className="landing-hero-section">
        <div className="landing-hero-bg-glow" />
        <div className="landing-container">
          <div className="row align-items-center g-4 g-xl-5">
            {/* Left Copy Column */}
            <div className="col-12 col-lg-6 landing-hero-copy">
              <div className="landing-tag-pill mb-3">
                <span className="landing-tag-dot" />
                <span>{t('landing.tagline')}</span>
              </div>

              <h1 className="landing-hero-heading">
                Smart Farm Management &amp; <span className="hero-gradient-text">Precision Agriculture</span> Software
              </h1>

              <p className="landing-hero-lead">
                <strong className="d-block text-dark mb-1">Cultivate with Precision. Harvest with Confidence.</strong>
                {t('landing.heroSubtitle')}
              </p>

              <div className="landing-hero-ctas d-flex flex-wrap align-items-center gap-3 mb-4">
                <Link to="/register" className="btn btn-primary btn-lg landing-hero-btn-primary shadow">
                  <i className="bi bi-rocket-takeoff-fill me-2" aria-hidden="true" />
                  <span>{t('landing.getStarted')}</span>
                  <i className="bi bi-arrow-right ms-2" aria-hidden="true" />
                </Link>
                <Link to="/login" className="btn btn-light btn-lg landing-hero-btn-secondary border shadow-sm">
                  <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true" />
                  <span>{t('landing.signIn')}</span>
                </Link>
              </div>

              {/* Value proposition badges */}
              <div className="landing-hero-perks d-flex flex-wrap align-items-center gap-3">
                <div className="landing-perk-item">
                  <i className="bi bi-check-circle-fill text-success me-1" />
                  <span>{t('landing.privateBadge')}</span>
                </div>
                <div className="landing-perk-item">
                  <i className="bi bi-check-circle-fill text-success me-1" />
                  <span>{t('landing.realtimeTelemetryPill')}</span>
                </div>
                <div className="landing-perk-item">
                  <i className="bi bi-check-circle-fill text-success me-1" />
                  <span>{t('landing.multiLanguageReadyPill')}</span>
                </div>
              </div>
            </div>

            {/* Right Slideshow Column */}
            <div className="col-12 col-lg-6">
              <div
                className="hero-slideshow-card"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                role="region"
                aria-label="Agricultural Showcase Slideshow"
              >
                {/* Countdown progress bar for active slide */}
                <div className="slideshow-progress-bar-track">
                  <div
                    key={currentSlide}
                    className={`slideshow-progress-bar-fill ${isPaused ? 'is-paused' : ''}`}
                  />
                </div>

                {/* Slides Container */}
                <div className="slideshow-viewport">
                  {SLIDES.map((slide, index) => {
                    const isActive = index === currentSlide;
                    return (
                      <div
                        key={slide.id}
                        className={`slideshow-slide ${isActive ? 'is-active' : ''}`}
                        aria-hidden={!isActive}
                      >
                        <img
                          src={slide.image}
                          alt={`${t(slide.titleKey)} - AgriTech Precision Agriculture`}
                          className="slideshow-img"
                          loading={index === 0 ? 'eager' : 'lazy'}
                        />
                        <div className="slideshow-gradient-scrim" />

                        {/* Slide Caption & Tag */}
                        <div className="slideshow-caption">
                          <span className="slideshow-tag-badge">
                            <i className={`bi ${slide.badgeIcon} me-1`} />
                            {slide.tag}
                          </span>
                          <h3 className="slideshow-title">{t(slide.titleKey)}</h3>
                          <p className="slideshow-subtitle mb-0">{t(slide.subtitleKey)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Floating Glassmorphism Status Badges */}
                <div className="floating-badge badge-top-left">
                  <span className="live-pulse-dot" />
                  <div>
                    <div className="floating-badge-title">{t('landing.soilMoisture')}</div>
                    <div className="floating-badge-val">68% • {t('landing.optimal')}</div>
                  </div>
                </div>

                <div className="floating-badge badge-bottom-right">
                  <i className="bi bi-graph-up-arrow text-warning floating-badge-icon" />
                  <div>
                    <div className="floating-badge-title">{t('landing.projectedYield')}</div>
                    <div className="floating-badge-val text-success">+24% vs Regional</div>
                  </div>
                </div>

                <div className="floating-badge badge-top-right d-none d-sm-flex">
                  <i className="bi bi-sun-fill text-warning floating-badge-icon" />
                  <div>
                    <div className="floating-badge-title">{t('landing.fieldWeather')}</div>
                    <div className="floating-badge-val">26°C Clear Skies</div>
                  </div>
                </div>

                {/* Controls (Prev, Next, Play/Pause, Indicators) */}
                <div className="slideshow-controls">
                  <button
                    type="button"
                    className="slideshow-nav-btn prev-btn"
                    onClick={prevSlide}
                    aria-label="Previous Slide"
                  >
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                  </button>

                  <div className="slideshow-indicators">
                    {SLIDES.map((slide, index) => (
                      <button
                        key={slide.id}
                        type="button"
                        className={`indicator-dot ${index === currentSlide ? 'active' : ''}`}
                        onClick={() => goToSlide(index)}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    className="slideshow-nav-btn next-btn"
                    onClick={nextSlide}
                    aria-label="Next Slide"
                  >
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="slideshow-pause-btn"
                    onClick={() => setIsPaused((prev) => !prev)}
                    title={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
                    aria-label={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
                  >
                    <i className={`bi ${isPaused ? 'bi-play-fill' : 'bi-pause-fill'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Counter Bar */}
      <section className="landing-stats-section" id="metrics">
        <div className="landing-container">
          <div className="stats-glass-card shadow-sm">
            <div className="row g-4 text-center">
              {STATS.map((stat, i) => (
                <div key={i} className="col-6 col-md-3">
                  <div className="stat-item-inner">
                    <div className="stat-icon-wrapper mb-2">
                      <i className={`bi ${stat.icon}`} aria-hidden="true" />
                    </div>
                    <div className="stat-number">{stat.value}</div>
                    <div className="stat-label">{t(stat.labelKey)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features & Architecture Grid */}
      <section className="landing-features-section" id="features">
        <div className="landing-container">
          <div className="section-header text-center mb-5">
            <span className="section-eyebrow">{t('landing.enterpriseArchitectureEyebrow')}</span>
            <h2 className="section-title">{t('landing.enterpriseArchitectureTitle')}</h2>
            <p className="section-subtitle">
              Combine precision spatial mapping, automated IoT telemetry, and growth cycle intelligence into one high-performance dashboard.
            </p>
          </div>

          <div className="row g-4">
            {FEATURES.map((feature, idx) => (
              <div key={idx} className="col-12 col-md-6 col-lg-4">
                <div className="feature-card-premium h-100">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div
                      className="feature-icon-box"
                      style={{ color: feature.color, backgroundColor: feature.bg }}
                    >
                      <i className={`bi ${feature.icon}`} aria-hidden="true" />
                    </div>
                    <span className="badge bg-light text-secondary border px-2 py-1 small rounded-pill">
                      {feature.metricBadge}
                    </span>
                  </div>
                  <h3 className="feature-card-title">{t(feature.titleKey)}</h3>
                  <p className="feature-card-desc">{t(feature.descKey)}</p>
                  <Link
                    to={`/features/${feature.slug}`}
                    className="text-decoration-none small fw-semibold text-success d-inline-flex align-items-center mt-2"
                  >
                    <span>{t('landing.exploreCapability')}</span>
                    <i className="bi bi-chevron-right ms-1 small" />
                  </Link>
                  <div className="feature-card-hover-indicator" style={{ backgroundColor: feature.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Interactive Intelligence Preview */}
      <section className="landing-preview-section" id="intelligence">
        <div className="landing-container">
          <div className="preview-container-card">
            <div className="row g-0 align-items-stretch">
              <div className="col-12 col-lg-4 preview-sidebar-col p-4 p-md-5">
                <div className="preview-badge mb-3">
                  <i className="bi bi-lightning-charge-fill me-1" />
                  <span>{t('landing.intelligenceHubEyebrow')}</span>
                </div>
                <h3 className="preview-heading mb-3">{t('landing.intelligenceHubTitle')}</h3>
                <p className="preview-text mb-4">
                  Experience seamless operational oversight with automated soil monitoring, crop stage timeline tracking, and live weather telemetry.
                </p>

                <div className="preview-tabs-list d-flex flex-column gap-2 mb-4">
                  <button
                    type="button"
                    className={`preview-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
                    onClick={() => setActiveTab('telemetry')}
                  >
                    <i className="bi bi-broadcast me-2" />
                    <span>{t('landing.iotSensorTelemetryTab')}</span>
                  </button>
                  <button
                    type="button"
                    className={`preview-tab-btn ${activeTab === 'crops' ? 'active' : ''}`}
                    onClick={() => setActiveTab('crops')}
                  >
                    <i className="bi bi-flower2 me-2" />
                    <span>{t('landing.cropCycleTrackingTab')}</span>
                  </button>
                  <button
                    type="button"
                    className={`preview-tab-btn ${activeTab === 'finances' ? 'active' : ''}`}
                    onClick={() => setActiveTab('finances')}
                  >
                    <i className="bi bi-cash-stack me-2" />
                    <span>{t('landing.financialBenchmarksTab')}</span>
                  </button>
                </div>

                <Link to="/register" className="btn btn-outline-success w-100">
                  <span>{t('landing.openFullDashboard')}</span>
                  <i className="bi bi-arrow-right ms-2" />
                </Link>
              </div>

              <div className="col-12 col-lg-8 preview-content-col p-4 p-md-5 d-flex flex-column justify-content-center">
                {activeTab === 'telemetry' && (
                  <div className="preview-screen-box animate-fadeIn">
                    <div className="d-flex align-items-center justify-content-between mb-4">
                      <div>
                        <h4 className="mb-0 fw-bold">{t('landing.fieldAlphaTitle')}</h4>
                        <small className="text-secondary">Node #SN-7489 • Updated 12 seconds ago</small>
                      </div>
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                        Active Telemetry 🟢
                      </span>
                    </div>

                    <div className="row g-3 mb-4">
                      <div className="col-6 col-sm-3">
                        <div className="telemetry-stat-card">
                          <small className="text-muted">{t('landing.soilMoisture')}</small>
                          <div className="fw-bold fs-4 text-success">68.2%</div>
                          <span className="badge bg-success bg-opacity-15 text-success small">{t('landing.optimal')}</span>
                        </div>
                      </div>
                      <div className="col-6 col-sm-3">
                        <div className="telemetry-stat-card">
                          <small className="text-muted">{t('farms.ambient')}</small>
                          <div className="fw-bold fs-4 text-primary">22.4°C</div>
                          <span className="badge bg-primary bg-opacity-15 text-primary small">{t('landing.normal')}</span>
                        </div>
                      </div>
                      <div className="col-6 col-sm-3">
                        <div className="telemetry-stat-card">
                          <small className="text-muted">Nitrogen (N)</small>
                          <div className="fw-bold fs-4 text-warning">48 mg/kg</div>
                          <span className="badge bg-warning bg-opacity-15 text-dark small">{t('landing.good')}</span>
                        </div>
                      </div>
                      <div className="col-6 col-sm-3">
                        <div className="telemetry-stat-card">
                          <small className="text-muted">Soil pH</small>
                          <div className="fw-bold fs-4 text-dark">6.7</div>
                          <span className="badge bg-secondary bg-opacity-15 text-secondary small">{t('landing.balanced')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bars demonstrating animated bars */}
                    <div className="mb-3">
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="fw-semibold">{t('landing.soilMoistureTarget')}</span>
                        <span className="text-success fw-bold">68.2%</span>
                      </div>
                      <div className="progress progress-animated-custom" style={{ height: '10px' }}>
                        <div className="progress-bar progress-bar-shimmer bg-success" style={{ width: '68.2%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="fw-semibold">{t('landing.nutrientAbsorptionCapacity')}</span>
                        <span className="text-primary fw-bold">84%</span>
                      </div>
                      <div className="progress progress-animated-custom" style={{ height: '10px' }}>
                        <div className="progress-bar progress-bar-shimmer bg-primary" style={{ width: '84%' }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'crops' && (
                  <div className="preview-screen-box animate-fadeIn">
                    <div className="d-flex align-items-center justify-content-between mb-4">
                      <div>
                        <h4 className="mb-0 fw-bold">{t('landing.wheatCycleTitle')}</h4>
                        <small className="text-secondary">{t('landing.stageHeadingGrainFilling')}</small>
                      </div>
                      <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25 px-2 py-1">
                        Harvest in 38 Days 🌾
                      </span>
                    </div>

                    <div className="crop-timeline-steps d-flex justify-content-between position-relative mb-4">
                      <div className="timeline-step completed">
                        <div className="step-circle"><i className="bi bi-check" /></div>
                        <span className="step-label">{t('landing.stepSowing')}</span>
                      </div>
                      <div className="timeline-step completed">
                        <div className="step-circle"><i className="bi bi-check" /></div>
                        <span className="step-label">{t('landing.stepVegetative')}</span>
                      </div>
                      <div className="timeline-step active">
                        <div className="step-circle"><i className="bi bi-brightness-high" /></div>
                        <span className="step-label">{t('landing.stepGrainFilling')}</span>
                      </div>
                      <div className="timeline-step">
                        <div className="step-circle"><i className="bi bi-clock" /></div>
                        <span className="step-label">{t('landing.stepMaturity')}</span>
                      </div>
                      <div className="timeline-step">
                        <div className="step-circle"><i className="bi bi-basket" /></div>
                        <span className="step-label">{t('landing.stepHarvest')}</span>
                      </div>
                    </div>

                    <div className="alert alert-success border-0 bg-success bg-opacity-10 mb-0 d-flex align-items-center gap-2">
                      <i className="bi bi-info-circle-fill text-success" />
                      <span className="small">
                        {t('landing.canopyReflectanceNote')}
                      </span>
                    </div>
                  </div>
                )}

                {activeTab === 'finances' && (
                  <div className="preview-screen-box animate-fadeIn">
                    <div className="d-flex align-items-center justify-content-between mb-4">
                      <div>
                        <h4 className="mb-0 fw-bold">{t('landing.seasonalProfitTitle')}</h4>
                        <small className="text-secondary">{t('landing.financialOverviewSubtitle')}</small>
                      </div>
                      <span className="badge bg-info bg-opacity-10 text-primary border border-info border-opacity-25 px-2 py-1">
                        +32.4% Net Margin
                      </span>
                    </div>

                    <div className="row g-3 mb-4">
                      <div className="col-4">
                        <div className="telemetry-stat-card">
                          <small className="text-muted">{t('landing.totalRevenue')}</small>
                          <div className="fw-bold fs-5 text-success">₹ 14,80,000</div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="telemetry-stat-card">
                          <small className="text-muted">{t('landing.operatingCosts')}</small>
                          <div className="fw-bold fs-5 text-danger">₹ 5,20,000</div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="telemetry-stat-card">
                          <small className="text-muted">{t('landing.netFarmProfit')}</small>
                          <div className="fw-bold fs-5 text-primary">₹ 9,60,000</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="fw-semibold">{t('landing.officialMspTarget')}</span>
                        <span className="text-success fw-bold">{t('landing.achievedMspPrice')}</span>
                      </div>
                      <div className="progress progress-animated-custom" style={{ height: '10px' }}>
                        <div className="progress-bar progress-bar-shimmer bg-success" style={{ width: '106%' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="landing-cta-section">
        <div className="landing-container">
          <div className="landing-cta-banner text-center">
            <div className="cta-sparkle-dot dot-1" />
            <div className="cta-sparkle-dot dot-2" />
            <h2 className="cta-banner-title mb-3">{t('landing.ctaTitle')}</h2>
            <p className="cta-banner-subtitle mx-auto mb-4">{t('landing.ctaSubtitle')}</p>
            <div className="d-flex flex-wrap justify-content-center gap-3">
              <Link to="/register" className="btn btn-light btn-lg cta-banner-btn shadow">
                <span>{t('landing.ctaBtn')}</span>
                <i className="bi bi-arrow-right ms-2" />
              </Link>
              <Link to="/login" className="btn btn-outline-light btn-lg">
                <span>{t('landing.signIn')}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container py-5 border-top">
          <div className="row g-4 mb-4">
            <div className="col-12 col-md-4">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="fw-bold text-dark fs-5">AgriTech</span>
              </div>
              <p className="text-secondary small mb-3">
                Smart farm management and precision agriculture software. Empowering growers with spatial field mapping, IoT telemetry, crop lifecycle scheduling, and agricultural supplies inventory.
              </p>
              <div className="d-flex align-items-center gap-2 text-secondary small">
                <span className="live-pulse-dot" style={{ width: '8px', height: '8px' }} />
                <span>{t('landing.allSystemsOperational')}</span>
              </div>
            </div>

            <div className="col-6 col-md-4">
              <div className="fw-bold text-dark mb-3 small text-uppercase">{t('landing.platformCapabilities')}</div>
              <ul className="list-unstyled d-flex flex-column gap-2 small">
                <li><Link to="/features/farm-management" className="text-decoration-none text-muted">{t('landing.multiFarmCapability')}</Link></li>
                <li><Link to="/features/field-mapping" className="text-decoration-none text-muted">{t('landing.gpsMappingCapability')}</Link></li>
                <li><Link to="/features/crop-operations" className="text-decoration-none text-muted">{t('landing.cropOperationsCapability')}</Link></li>
                <li><Link to="/features/weather-monitoring" className="text-decoration-none text-muted">{t('landing.weatherMonitoringCapability')}</Link></li>
                <li><Link to="/features/resource-inventory" className="text-decoration-none text-muted">{t('landing.suppliesCapability')}</Link></li>
              </ul>
            </div>

            <div className="col-6 col-md-4">
              <div className="fw-bold text-dark mb-3 small text-uppercase">{t('landing.farmPortal')}</div>
              <ul className="list-unstyled d-flex flex-column gap-2 small">
                <li><Link to="/features" className="text-decoration-none text-muted">{t('landing.featuresGuide')}</Link></li>
                <li><Link to="/login" className="text-decoration-none text-muted">{t('landing.farmerSignIn')}</Link></li>
                <li><Link to="/register" className="text-decoration-none text-muted">{t('landing.createFreeWorkspace')}</Link></li>
                <li><Link to="/" className="text-decoration-none text-muted">AgriTech</Link></li>
              </ul>
            </div>
          </div>

          <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 pt-4 border-top text-secondary small">
            <div>&copy; {new Date().getFullYear()} AgriTech. Precision Agriculture &amp; Farm Operations.</div>
            <div className="d-flex align-items-center gap-3">
              <span>{t('landing.ownerIsolatedVault')}</span>
              <span>•</span>
              <span>{t('landing.panIndiaLanguages')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
