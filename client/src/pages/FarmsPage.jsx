import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { apiRequest } from '../lib/api.js';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui.jsx';

const INDIAN_AGRI_PRESETS = [
  { label: 'Ludhiana, Punjab', state: 'Punjab', district: 'Ludhiana', lat: 30.9010, lng: 75.8573, note: 'Wheat & Paddy' },
  { label: 'Karnal, Haryana', state: 'Haryana', district: 'Karnal', lat: 29.6857, lng: 76.9905, note: 'Basmati Belt' },
  { label: 'Nashik, Maharashtra', state: 'Maharashtra', district: 'Nashik', lat: 19.9975, lng: 73.7898, note: 'Onion & Grape' },
  { label: 'Rajkot, Gujarat', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022, note: 'Groundnut & Cotton' },
  { label: 'Guntur, Andhra Pradesh', state: 'Andhra Pradesh', district: 'Guntur', lat: 16.3067, lng: 80.4365, note: 'Chili & Tobacco' },
  { label: 'Varanasi, Uttar Pradesh', state: 'Uttar Pradesh', district: 'Varanasi', lat: 25.3176, lng: 82.9739, note: 'Gangetic Plains' },
  { label: 'Mandya, Karnataka', state: 'Karnataka', district: 'Mandya', lat: 12.5218, lng: 76.8951, note: 'Sugarcane Valley' },
  { label: 'Burdwan, West Bengal', state: 'West Bengal', district: 'Purba Bardhaman', lat: 23.2324, lng: 87.8615, note: 'Rice Bowl' },
  { label: 'Thanjavur, Tamil Nadu', state: 'Tamil Nadu', district: 'Thanjavur', lat: 10.7870, lng: 79.1378, note: 'Cauvery Delta' },
];

const INDIAN_STATES = [
  'Punjab',
  'Haryana',
  'Uttar Pradesh',
  'Maharashtra',
  'Gujarat',
  'Andhra Pradesh',
  'Telangana',
  'Karnataka',
  'Tamil Nadu',
  'West Bengal',
  'Madhya Pradesh',
  'Rajasthan',
  'Bihar',
  'Odisha',
  'Kerala',
];

const SOIL_TYPES = [
  { id: 'Alluvial Soil', label: 'Alluvial Soil (जलोढ़)' },
  { id: 'Black Cotton Soil', label: 'Black Cotton Soil (काली / रेगुर)' },
  { id: 'Red & Yellow Soil', label: 'Red & Yellow Soil (लाल मिट्टी)' },
  { id: 'Laterite Soil', label: 'Laterite Soil (लैटेराइट)' },
  { id: 'Clayey Loam', label: 'Clayey Loam (चिकनी दोमट)' },
  { id: 'Sandy Loam', label: 'Sandy Loam (बलुई दोमट)' },
];

const IRRIGATION_SOURCES = [
  { id: 'Drip Micro-Irrigation', label: 'Drip Micro-Irrigation (ड्रिप)' },
  { id: 'Sprinkler System', label: 'Sprinkler System (फव्वारा)' },
  { id: 'Canal Flow', label: 'Canal Flow (नहरी सिंचाई)' },
  { id: 'Deep Tube-well', label: 'Deep Tube-well (बोरवेल)' },
  { id: 'Rainfed / Monsoon', label: 'Rainfed / Monsoon (वर्षा आधारित)' },
];

const FarmsPage = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();

  const [farms, setFarms] = useState([]);
  const [farmFields, setFarmFields] = useState({});
  const [farmWeather, setFarmWeather] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [busyId, setBusyId] = useState(null);

  // Search, Filter & Layout
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Inline Rename
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  // Create Farm Form
  const [form, setForm] = useState({
    name: '',
    region: '',
    city: '',
    country: 'India',
    latitude: '',
    longitude: '',
  });
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsStatusNotice, setGpsStatusNotice] = useState('');

  // Quick Add Field Modal
  const [fieldModalFarm, setFieldModalFarm] = useState(null);
  const [fieldForm, setFieldForm] = useState({
    name: '',
    areaHectares: '',
    soilType: 'Alluvial Soil',
    waterSource: 'Drip Micro-Irrigation',
  });
  const [fieldSubmitting, setFieldSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState('');

  // Edit Location / GPS Modal
  const [locationModalFarm, setLocationModalFarm] = useState(null);
  const [locationForm, setLocationForm] = useState({
    region: '',
    city: '',
    latitude: '',
    longitude: '',
  });
  const [locationSubmitting, setLocationSubmitting] = useState(false);

  // Load Farms, Fields & Mini Weather
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const farmsData = await apiRequest('/farms', { token });
        if (!active) return;
        const loadedFarms = farmsData.farms || [];
        setFarms(loadedFarms);

        // Fetch fields & weather for each farm
        const fieldsMap = {};
        const weatherMap = {};

        await Promise.all(
          loadedFarms.map(async (farm) => {
            try {
              const res = await apiRequest(`/farms/${farm._id}/fields`, { token });
              fieldsMap[farm._id] = res.fields || [];
            } catch {
              fieldsMap[farm._id] = [];
            }
          })
        );

        // Fetch weather sequentially to avoid concurrent rate limit collisions
        for (const farm of loadedFarms) {
          if (farm.location?.latitude && farm.location?.longitude) {
            try {
              const weatherRes = await apiRequest(`/weather/farms/${farm._id}`, { token });
              if (weatherRes.data?.current) {
                weatherMap[farm._id] = weatherRes.data.current;
              }
            } catch {
              // Weather is optional
            }
          }
        }

        if (active) {
          setFarmFields(fieldsMap);
          setFarmWeather(weatherMap);
          setError('');
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [token, retryCount]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalFarmsCount = farms.length;
    let totalAreaHa = 0;
    let totalFieldsCount = 0;
    let weatherActiveCount = 0;

    farms.forEach((farm) => {
      if (farm.location?.latitude && farm.location?.longitude) {
        weatherActiveCount += 1;
      }
      const fields = farmFields[farm._id] || [];
      totalFieldsCount += fields.length;
      fields.forEach((field) => {
        const area = Number(field.areaHectares) || 0;
        totalAreaHa += area;
      });
    });

    const totalAcres = (totalAreaHa * 2.47105).toFixed(1);

    return {
      totalFarmsCount,
      totalAreaHa: totalAreaHa.toFixed(1),
      totalAcres,
      totalFieldsCount,
      weatherActiveCount,
    };
  }, [farms, farmFields]);

  // Unique Regions for Filter Pills
  const regionsList = useMemo(() => {
    const set = new Set();
    farms.forEach((f) => {
      if (f.location?.region) set.add(f.location.region.trim());
    });
    return Array.from(set).sort();
  }, [farms]);

  // Filtered & Sorted Farms
  const visibleFarms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return farms
      .filter((farm) => {
        // Search
        if (q) {
          const matchName = farm.name?.toLowerCase().includes(q);
          const matchRegion = farm.location?.region?.toLowerCase().includes(q);
          const matchCity = farm.location?.city?.toLowerCase().includes(q);
          const fields = farmFields[farm._id] || [];
          const matchField = fields.some((fld) => fld.name?.toLowerCase().includes(q));
          if (!matchName && !matchRegion && !matchCity && !matchField) return false;
        }
        // Region
        if (selectedRegion !== 'ALL') {
          if (farm.location?.region !== selectedRegion) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortBy === 'area') {
          const areaA = (farmFields[a._id] || []).reduce((acc, f) => acc + (f.areaHectares || 0), 0);
          const areaB = (farmFields[b._id] || []).reduce((acc, f) => acc + (f.areaHectares || 0), 0);
          return areaB - areaA;
        }
        // newest (default)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }, [farms, farmFields, searchQuery, selectedRegion, sortBy]);

  // GPS Detection Handler
  const handleDetectDeviceGps = (target = 'create') => {
    if (!navigator.geolocation) {
      setGpsStatusNotice('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingGps(true);
    setGpsStatusNotice('Acquiring satellite lock…');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        if (target === 'create') {
          setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        } else if (target === 'locationModal') {
          setLocationForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        }
        setDetectingGps(false);
        setGpsStatusNotice(t('farms.gpsDetected') || 'GPS detected accurately');
      },
      (err) => {
        setDetectingGps(false);
        setGpsStatusNotice(`GPS Notice: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Preset Selection Handler
  const handleApplyPreset = (preset, target = 'create') => {
    if (target === 'create') {
      setForm((prev) => ({
        ...prev,
        region: preset.state,
        city: preset.district,
        country: 'India',
        latitude: String(preset.lat),
        longitude: String(preset.lng),
      }));
    } else {
      setLocationForm((prev) => ({
        ...prev,
        region: preset.state,
        city: preset.district,
        latitude: String(preset.lat),
        longitude: String(preset.lng),
      }));
    }
    setGpsStatusNotice(`Preset applied: ${preset.label} (${preset.note})`);
  };

  // Create Farm
  const createFarm = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const location = {};
      if (form.region.trim()) location.region = form.region.trim();
      if (form.city.trim()) location.city = form.city.trim();
      if (form.country.trim()) location.country = form.country.trim();
      if (form.latitude !== '' && !isNaN(Number(form.latitude))) location.latitude = Number(form.latitude);
      if (form.longitude !== '' && !isNaN(Number(form.longitude))) location.longitude = Number(form.longitude);

      const data = await apiRequest('/farms', {
        method: 'POST',
        token,
        body: {
          name: form.name.trim(),
          ...(Object.keys(location).length ? { location } : {}),
        },
      });

      const newFarm = data.farm;
      setFarms((current) => [newFarm, ...current]);
      setFarmFields((prev) => ({ ...prev, [newFarm._id]: [] }));
      setForm({ name: '', region: '', city: '', country: 'India', latitude: '', longitude: '' });
      setGpsStatusNotice('');
      setNotice('Farm registered successfully.');

      // If coordinates are set, fetch weather
      if (newFarm.location?.latitude && newFarm.location?.longitude) {
        try {
          const weatherRes = await apiRequest(`/weather/farms/${newFarm._id}`, { token });
          if (weatherRes.data?.current) {
            setFarmWeather((prev) => ({ ...prev, [newFarm._id]: weatherRes.data.current }));
          }
        } catch {
          // Weather optional
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Inline Rename
  const saveFarmName = async (farmId) => {
    setError('');
    setNotice('');
    setBusyId(farmId);
    try {
      const data = await apiRequest(`/farms/${farmId}`, {
        method: 'PATCH',
        token,
        body: { name: editName.trim() },
      });
      setFarms((current) => current.map((f) => (f._id === farmId ? data.farm : f)));
      setEditingId(null);
      setNotice('Farm name updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // Delete Farm
  const deleteFarm = async (farm) => {
    const fieldsCount = (farmFields[farm._id] || []).length;
    if (fieldsCount > 0) {
      alert(`Cannot delete “${farm.name}” because it currently contains ${fieldsCount} active field(s). Delete fields first from the farm detail view.`);
      return;
    }
    if (!window.confirm(t('farms.deleteConfirm', { name: farm.name }))) return;

    setError('');
    setNotice('');
    setBusyId(farm._id);
    try {
      await apiRequest(`/farms/${farm._id}`, { method: 'DELETE', token });
      setFarms((current) => current.filter((item) => item._id !== farm._id));
      setNotice('Farm removed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // Quick Add Field
  const openFieldModal = (farm) => {
    setFieldModalFarm(farm);
    setFieldForm({
      name: '',
      areaHectares: '',
      soilType: 'Alluvial Soil',
      waterSource: 'Drip Micro-Irrigation',
    });
    setFieldError('');
  };

  const handleCreateField = async (e) => {
    e.preventDefault();
    if (!fieldModalFarm) return;
    setFieldSubmitting(true);
    setFieldError('');

    try {
      const body = {
        name: fieldForm.name.trim(),
        areaHectares: Number(fieldForm.areaHectares),
        soilType: fieldForm.soilType,
        waterSource: fieldForm.waterSource,
      };
      const res = await apiRequest(`/farms/${fieldModalFarm._id}/fields`, {
        method: 'POST',
        token,
        body,
      });

      const newField = res.field;
      setFarmFields((prev) => ({
        ...prev,
        [fieldModalFarm._id]: [...(prev[fieldModalFarm._id] || []), newField],
      }));
      setNotice(`Field “${newField.name}” added to ${fieldModalFarm.name}.`);
      setFieldModalFarm(null);
    } catch (err) {
      setFieldError(err.message);
    } finally {
      setFieldSubmitting(false);
    }
  };

  // Edit Location / GPS Modal
  const openLocationModal = (farm) => {
    setLocationModalFarm(farm);
    setLocationForm({
      region: farm.location?.region || '',
      city: farm.location?.city || '',
      latitude: farm.location?.latitude != null ? String(farm.location.latitude) : '',
      longitude: farm.location?.longitude != null ? String(farm.location.longitude) : '',
    });
    setGpsStatusNotice('');
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!locationModalFarm) return;
    setLocationSubmitting(true);
    setError('');

    try {
      const loc = {
        region: locationForm.region.trim(),
        city: locationForm.city.trim(),
        country: locationModalFarm.location?.country || 'India',
      };
      if (locationForm.latitude !== '' && !isNaN(Number(locationForm.latitude))) {
        loc.latitude = Number(locationForm.latitude);
      }
      if (locationForm.longitude !== '' && !isNaN(Number(locationForm.longitude))) {
        loc.longitude = Number(locationForm.longitude);
      }

      const res = await apiRequest(`/farms/${locationModalFarm._id}`, {
        method: 'PATCH',
        token,
        body: { location: loc },
      });

      const updated = res.farm;
      setFarms((current) => current.map((f) => (f._id === updated._id ? updated : f)));
      setLocationModalFarm(null);
      setNotice(`Coordinates & location updated for “${updated.name}”.`);

      // Refresh weather for this farm
      if (updated.location?.latitude && updated.location?.longitude) {
        try {
          const weatherRes = await apiRequest(`/weather/farms/${updated._id}`, { token });
          if (weatherRes.data?.current) {
            setFarmWeather((prev) => ({ ...prev, [updated._id]: weatherRes.data.current }));
          }
        } catch {
          // Weather optional
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLocationSubmitting(false);
    }
  };

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow={t('farms.eyebrow')}
        title={t('farms.title')}
        description={t('farms.description')}
        actions={
          <a className="btn btn-primary shadow-sm" href="#add-farm">
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            {t('farms.addFarm')}
          </a>
        }
      />

      {error && (
        <ErrorState
          message={error}
          retrying={loading}
          onRetry={() => {
            setLoading(true);
            setRetryCount((c) => c + 1);
          }}
        />
      )}

      {notice && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm" role="status">
          <i className="bi bi-check-circle-fill me-2" />
          {notice}
          <button type="button" className="btn-close" onClick={() => setNotice('')} aria-label="Close" />
        </div>
      )}

      {/* Metrics Deck */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 rounded-4 p-3 h-100 bg-white metric-kpi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold text-uppercase">{t('farms.totalFarms')}</span>
              <span className="badge bg-success-subtle text-success p-2 rounded-3">
                <i className="bi bi-houses fs-6" aria-hidden="true" />
              </span>
            </div>
            <div className="h3 fw-bold text-dark mb-0">{metrics.totalFarmsCount}</div>
            <div className="text-muted small mt-1">{t('farms.activeEstates')}</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 rounded-4 p-3 h-100 bg-white metric-kpi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold text-uppercase">{t('farms.totalCultivated')}</span>
              <span className="badge bg-primary-subtle text-primary p-2 rounded-3">
                <i className="bi bi-aspect-ratio fs-6" aria-hidden="true" />
              </span>
            </div>
            <div className="h3 fw-bold text-dark mb-0">
              {metrics.totalAreaHa} <span className="fs-6 fw-normal text-muted">ha</span>
            </div>
            <div className="text-muted small mt-1">~{metrics.totalAcres} {t('farms.acres')}</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 rounded-4 p-3 h-100 bg-white metric-kpi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold text-uppercase">{t('farms.totalFields')}</span>
              <span className="badge bg-warning-subtle text-warning p-2 rounded-3">
                <i className="bi bi-grid-3x3 fs-6" aria-hidden="true" />
              </span>
            </div>
            <div className="h3 fw-bold text-dark mb-0">{metrics.totalFieldsCount}</div>
            <div className="text-muted small mt-1">{t('farms.plotsSoilParcels')}</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card shadow-sm border-0 rounded-4 p-3 h-100 bg-white metric-kpi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold text-uppercase">{t('farms.gpsAndWeather')}</span>
              <span className="badge bg-info-subtle text-info p-2 rounded-3">
                <i className="bi bi-broadcast-pin fs-6" aria-hidden="true" />
              </span>
            </div>
            <div className="h3 fw-bold text-dark mb-0">
              {metrics.weatherActiveCount} / {metrics.totalFarmsCount}
            </div>
            <div className="text-muted small mt-1">{t('farms.farmsWithLiveWeather')}</div>
          </div>
        </div>
      </div>

      {/* Interactive Search, Filter & View Controls */}
      <div className="card shadow-sm border-0 rounded-4 p-3 mb-4 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5 col-lg-4">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <i className="bi bi-search" aria-hidden="true" />
              </span>
              <input
                type="text"
                className="form-control border-start-0 bg-light"
                placeholder={t('farms.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="btn btn-light border"
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <i className="bi bi-x-lg text-muted small" />
                </button>
              )}
            </div>
          </div>

          <div className="col-12 col-sm-7 col-md-4 col-lg-5">
            <div className="d-flex align-items-center gap-1 overflow-x-auto py-1 filter-pills-bar">
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 text-nowrap ${
                  selectedRegion === 'ALL' ? 'btn-success text-white shadow-sm' : 'btn-light border text-dark'
                }`}
                onClick={() => setSelectedRegion('ALL')}
              >
                {t('farms.allRegions')} ({farms.length})
              </button>
              {regionsList.map((region) => (
                <button
                  key={region}
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 py-1 text-nowrap ${
                    selectedRegion === region ? 'btn-success text-white shadow-sm' : 'btn-light border text-dark'
                  }`}
                  onClick={() => setSelectedRegion(region)}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          <div className="col-12 col-sm-5 col-md-3 col-lg-3 text-start text-sm-end d-flex align-items-center justify-content-between justify-content-sm-end gap-2">
            <select
              className="form-select form-select-sm w-auto"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort farms"
            >
              <option value="newest">{t('farms.sortNewest')}</option>
              <option value="oldest">{t('farms.sortOldest')}</option>
              <option value="name">{t('farms.sortName')}</option>
              <option value="area">{t('farms.sortArea')}</option>
            </select>

            <div className="btn-group btn-group-sm" role="group" aria-label="Layout mode">
              <button
                type="button"
                className={`btn ${viewMode === 'grid' ? 'btn-secondary text-white' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <i className="bi bi-grid-fill" />
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'list' ? 'btn-secondary text-white' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <i className="bi bi-list-ul" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Farms List + Add Farm Card */}
      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-7">
          {loading ? (
            <LoadingState>{t('common.loading')}</LoadingState>
          ) : visibleFarms.length ? (
            <div className={viewMode === 'grid' ? 'row g-3' : 'd-flex flex-column gap-3'}>
              {visibleFarms.map((farm) => {
                const fields = farmFields[farm._id] || [];
                const farmAreaHa = fields.reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0);
                const farmAcres = (farmAreaHa * 2.47105).toFixed(1);
                const hasCoordinates = farm.location?.latitude != null && farm.location?.longitude != null;
                const weather = farmWeather[farm._id];

                return (
                  <div key={farm._id} className={viewMode === 'grid' ? 'col-12' : 'w-100'}>
                    <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white interactive-farm-card">
                      {/* Top Accent Bar */}
                      <div className="farm-card-accent-bar" style={{ height: '4px', background: 'linear-gradient(90deg, #10b981 0%, #34d399 50%, #059669 100%)' }} />

                      <div className="card-body p-3 p-md-4">
                        {/* Header & Inline Rename */}
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                          <div className="d-flex align-items-center gap-2 flex-grow-1">
                            <span className="farm-avatar-badge rounded-circle d-inline-flex align-items-center justify-content-center bg-success-subtle text-success fw-bold" style={{ width: '42px', height: '42px', fontSize: '1.1rem' }}>
                              <i className="bi bi-house-heart" />
                            </span>

                            {editingId === farm._id ? (
                              <form
                                className="d-flex align-items-center gap-2 flex-grow-1"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  saveFarmName(farm._id);
                                }}
                              >
                                <input
                                  className="form-control form-control-sm"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  maxLength={100}
                                  required
                                  autoFocus
                                />
                                <button className="btn btn-success btn-sm" type="submit" disabled={busyId === farm._id}>
                                  {busyId === farm._id ? '…' : t('common.save')}
                                </button>
                                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setEditingId(null)}>
                                  {t('common.cancel')}
                                </button>
                              </form>
                            ) : (
                              <div>
                                <Link to={`/farms/${farm._id}`} className="h5 fw-bold text-dark text-decoration-none farm-hover-link mb-0 d-block">
                                  {farm.name}
                                </Link>
                                <span className="text-secondary small d-flex align-items-center gap-1 mt-0-5">
                                  <i className="bi bi-geo-alt-fill text-danger small" />
                                  {[farm.location?.city, farm.location?.region, farm.location?.country].filter(Boolean).join(', ') || 'India'}
                                </span>
                              </div>
                            )}
                          </div>

                          <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 small">
                            {t('farms.allSystemsNominal')}
                          </span>
                        </div>

                        {/* Fields & Area Snapshot Badges */}
                        <div className="d-flex flex-wrap align-items-center gap-2 my-3 py-2 border-top border-bottom">
                          <div className="badge bg-light text-dark border px-2-5 py-1-5 rounded-pill d-inline-flex align-items-center gap-1">
                            <i className="bi bi-grid text-primary" />
                            <strong className="text-dark">{fields.length}</strong> Fields
                          </div>
                          <div className="badge bg-light text-dark border px-2-5 py-1-5 rounded-pill d-inline-flex align-items-center gap-1">
                            <i className="bi bi-aspect-ratio text-success" />
                            <strong className="text-dark">{farmAreaHa.toFixed(1)}</strong> ha ({farmAcres} ac)
                          </div>

                          {hasCoordinates ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2-5 py-1-5 rounded-pill d-inline-flex align-items-center gap-1">
                              <i className="bi bi-pin-map-fill text-success" />
                              GPS: {Number(farm.location.latitude).toFixed(2)}°, {Number(farm.location.longitude).toFixed(2)}°
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-warning btn-sm py-0 px-2 rounded-pill small d-inline-flex align-items-center gap-1 text-dark fw-semibold"
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => openLocationModal(farm)}
                            >
                              <i className="bi bi-exclamation-triangle-fill" />
                              {t('farms.gpsMissing')}
                            </button>
                          )}
                        </div>

                        {/* Mini Weather Preview Bar */}
                        {hasCoordinates && weather && (
                          <div className="bg-light rounded-3 p-2-5 mb-3 d-flex align-items-center justify-content-between small">
                            <div className="d-flex align-items-center gap-2">
                              <i className="bi bi-sun text-warning fs-5" />
                              <div>
                                <span className="fw-bold text-dark">{weather.temperature_2m}°C</span>
                                <span className="text-muted ms-1">{t('farms.ambient')}</span>
                              </div>
                            </div>
                            <div className="text-muted small">
                              Humidity: <strong className="text-dark">{weather.relative_humidity_2m}%</strong>
                            </div>
                            <div className="text-muted small d-none d-sm-block">
                              Wind: <strong className="text-dark">{weather.wind_speed_10m} km/h</strong>
                            </div>
                            <span className="badge bg-success text-white small" style={{ fontSize: '0.65rem' }}>
                              LIVE WEATHER
                            </span>
                          </div>
                        )}

                        {/* Fields Preview Chips */}
                        {fields.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1-5 mb-3">
                            {fields.slice(0, 3).map((fld) => (
                              <span key={fld._id} className="badge bg-light text-secondary border px-2 py-1 rounded-2 small fw-normal">
                                <i className="bi bi-tag me-1 text-muted" />
                                {fld.name} ({fld.areaHectares} ha{fld.soilType ? ` • ${fld.soilType.split(' ')[0]}` : ''})
                              </span>
                            ))}
                            {fields.length > 3 && (
                              <span className="badge bg-light text-muted border px-2 py-1 rounded-2 small">
                                +{fields.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-muted small mb-3 fst-italic">
                            No plots configured yet in this farm.
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-2 border-top">
                          <Link to={`/farms/${farm._id}`} className="btn btn-outline-success btn-sm fw-semibold">
                            {t('farms.viewFields')} <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                          </Link>

                          <div className="d-flex flex-wrap align-items-center gap-1">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => openFieldModal(farm)}
                              title={t('farms.quickAddField')}
                            >
                              <i className="bi bi-plus-circle me-1" />
                              <span className="d-none d-sm-inline">{t('farms.quickAddField')}</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => openLocationModal(farm)}
                              title={t('farms.editLocation')}
                            >
                              <i className="bi bi-geo-alt" />
                            </button>

                            <Link
                              to={`/mapping?farmId=${farm._id}`}
                              className="btn btn-outline-success btn-sm"
                              title={t('features.fieldMapping')}
                            >
                              <i className="bi bi-map me-1" />
                              Map
                            </Link>

                            {editingId !== farm._id && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  disabled={busyId === farm._id}
                                  onClick={() => {
                                    setEditName(farm.name);
                                    setEditingId(farm._id);
                                  }}
                                  title={t('farms.rename')}
                                >
                                  <i className="bi bi-pencil" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => deleteFarm(farm)}
                                  disabled={busyId === farm._id}
                                  title={t('common.delete')}
                                >
                                  <i className="bi bi-trash3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !error ? (
            <Card className="rounded-4 border-0 shadow-sm p-4 text-center">
              <EmptyState
                icon="bi-map"
                title={searchQuery || selectedRegion !== 'ALL' ? t('farms.noFarmsFound') : t('farms.noFarmsYet')}
                description={t('farms.startAdding')}
                action={
                  <a className="btn btn-primary shadow-sm" href="#add-farm">
                    <i className="bi bi-plus-lg me-1" /> {t('farms.quickAddTitle')}
                  </a>
                }
              />
            </Card>
          ) : null}
        </div>

        {/* Right Side: Register New Farm Form with GPS & Hub Presets */}
        <div className="col-12 col-xl-5">
          {user?.role === 'admin' ? (
            <Card className="form-card rounded-4 border-0 shadow-sm p-4 bg-light border-primary-subtle" id="add-farm">
              <div className="d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-shield-shaded text-primary fs-3" />
                <div>
                  <h3 className="h6 fw-bold mb-0 text-primary">{t('farms.adminAgriRestriction')}</h3>
                  <small className="text-secondary">{t('farms.platformGovernanceProtocol')}</small>
                </div>
              </div>
              <p className="small text-secondary mb-3">
                In accordance with platform security and access control policies, Administrators manage system users and oversee all regional agricultural holdings via the Admin Console. Creation or modification of personal farm workspaces is restricted for administrative accounts.
              </p>
              <Link to="/admin" className="btn btn-primary btn-sm fw-semibold w-100 d-flex align-items-center justify-content-center gap-2 py-2">
                <i className="bi bi-geo-alt" />
                Open Land &amp; Farms Oversight in Admin Console
              </Link>
            </Card>
          ) : (
            <Card className="form-card rounded-4 border-0 shadow-sm p-3 p-md-4" id="add-farm">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="badge bg-success-subtle text-success rounded-pill px-2-5 py-1 small fw-semibold">
                  {t('farms.quickAddTitle')}
                </span>
                <span className="text-muted small">{t('farms.indiaHub')}</span>
              </div>

              <h2 className="h5 fw-bold text-dark mb-1">{t('farms.quickAddTitle')}</h2>
              <p className="text-secondary small mb-3">
                Configure boundaries, region, and geo-coordinates for automated meteorological tracking.
              </p>

              <form onSubmit={createFarm}>
                {/* Farm Name */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark" htmlFor="farm-name">
                    {t('farms.farmNameLabel')} <span className="text-danger">*</span>
                  </label>
                  <input
                    id="farm-name"
                    className="form-control"
                    placeholder={t('farms.farmNamePlaceholder')}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    maxLength={100}
                    required
                  />
                </div>

              {/* State & District */}
              <div className="row g-2 mb-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold text-dark" htmlFor="farm-region">
                    {t('farms.stateRegionLabel')}
                  </label>
                  <input
                    id="farm-region"
                    className="form-control form-control-sm"
                    list="indian-states-list"
                    placeholder="e.g. Punjab, Maharashtra"
                    value={form.region}
                    onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
                    maxLength={100}
                  />
                  <datalist id="indian-states-list">
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st} />
                    ))}
                  </datalist>
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold text-dark" htmlFor="farm-city">
                    {t('farms.cityDistrictLabel')}
                  </label>
                  <input
                    id="farm-city"
                    className="form-control form-control-sm"
                    placeholder="e.g. Ludhiana, Nashik"
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    maxLength={100}
                  />
                </div>
              </div>

              {/* GPS Coordinates Header & Detection */}
              <div className="card bg-light border-0 rounded-3 p-3 mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small fw-bold text-dark d-flex align-items-center gap-1">
                    <i className="bi bi-geo-alt-fill text-danger" />
                    Geographical Coordinates
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm py-0 px-2 rounded-pill small d-inline-flex align-items-center gap-1"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => handleDetectDeviceGps('create')}
                    disabled={detectingGps}
                  >
                    {detectingGps ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    ) : (
                      <i className="bi bi-crosshair" />
                    )}
                    {t('farms.useDeviceGps')}
                  </button>
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-12 col-sm-6">
                    <label className="form-label small text-muted mb-1" htmlFor="farm-lat">
                      {t('farms.latitudeLabel')}
                    </label>
                    <input
                      id="farm-lat"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      inputMode="decimal"
                      className="form-control form-control-sm bg-white"
                      placeholder="e.g. 30.9010"
                      value={form.latitude}
                      onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small text-muted mb-1" htmlFor="farm-lng">
                      {t('farms.longitudeLabel')}
                    </label>
                    <input
                      id="farm-lng"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      inputMode="decimal"
                      className="form-control form-control-sm bg-white"
                      placeholder="e.g. 75.8573"
                      value={form.longitude}
                      onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                    />
                  </div>
                </div>

                {gpsStatusNotice && (
                  <p className="small text-success mb-2 fw-semibold" style={{ fontSize: '0.75rem' }}>
                    <i className="bi bi-info-circle me-1" />
                    {gpsStatusNotice}
                  </p>
                )}

                {/* Quick Indian Agricultural Hub Presets */}
                <div className="mt-2 pt-2 border-top">
                  <span className="text-muted small d-block mb-1-5" style={{ fontSize: '0.72rem' }}>
                    {t('farms.quickPresets')}:
                  </span>
                  <div className="d-flex flex-wrap gap-1">
                    {INDIAN_AGRI_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="btn btn-white btn-sm border py-0-5 px-2 rounded-2 small text-dark preset-chip"
                        style={{ fontSize: '0.7rem' }}
                        onClick={() => handleApplyPreset(p, 'create')}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button className="btn btn-primary w-100 py-2 shadow-sm fw-semibold" type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    <i className="bi bi-plus-lg me-2" aria-hidden="true" />
                    {t('farms.addFarm')}
                  </>
                )}
              </button>
            </form>
          </Card>
          )}
        </div>
      </div>

      {/* Quick Add Field Modal */}
      {fieldModalFarm && (
        <div className="custom-modal-backdrop" role="dialog" aria-modal="true">
          <div className="custom-modal-card card shadow-lg border-0 rounded-4 p-3 p-sm-4">
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-success-subtle text-success p-2 rounded-3">
                  <i className="bi bi-grid-plus fs-5" />
                </span>
                <div>
                  <h3 className="h6 fw-bold mb-0">
                    {t('farms.addFieldModalTitle', { farmName: fieldModalFarm.name })}
                  </h3>
                  <small className="text-muted">{t('farms.createParcelSoilHelp')}</small>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setFieldModalFarm(null)}
                aria-label="Close"
              />
            </div>

            {fieldError && <div className="alert alert-danger small py-2 mb-3">{fieldError}</div>}

            <form onSubmit={handleCreateField}>
              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="field-name">
                  {t('farms.fieldNameLabel')} <span className="text-danger">*</span>
                </label>
                <input
                  id="field-name"
                  className="form-control"
                  placeholder={t('farms.fieldNamePlaceholder')}
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm((p) => ({ ...p, name: e.target.value }))}
                  maxLength={100}
                  required
                  autoFocus
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="field-area">
                  {t('farms.fieldAreaLabel')} <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input
                    id="field-area"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="1000000"
                    inputMode="decimal"
                    className="form-control"
                    placeholder="e.g. 2.5"
                    value={fieldForm.areaHectares}
                    onChange={(e) => setFieldForm((p) => ({ ...p, areaHectares: e.target.value }))}
                    required
                  />
                  <span className="input-group-text bg-light">
                    ha {fieldForm.areaHectares ? `(~${(Number(fieldForm.areaHectares) * 2.47105).toFixed(1)} ac)` : ''}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="field-soil">
                  {t('farms.soilTypeLabel')}
                </label>
                <select
                  id="field-soil"
                  className="form-select"
                  value={fieldForm.soilType}
                  onChange={(e) => setFieldForm((p) => ({ ...p, soilType: e.target.value }))}
                >
                  {SOIL_TYPES.map((soil) => (
                    <option key={soil.id} value={soil.id}>
                      {soil.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold" htmlFor="field-water">
                  {t('farms.waterSourceLabel')}
                </label>
                <select
                  id="field-water"
                  className="form-select"
                  value={fieldForm.waterSource}
                  onChange={(e) => setFieldForm((p) => ({ ...p, waterSource: e.target.value }))}
                >
                  {IRRIGATION_SOURCES.map((irr) => (
                    <option key={irr.id} value={irr.id}>
                      {irr.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setFieldModalFarm(null)}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-success fw-semibold" disabled={fieldSubmitting}>
                  {fieldSubmitting ? t('common.saving') : t('farms.quickAddField')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Location / GPS Modal */}
      {locationModalFarm && (
        <div className="custom-modal-backdrop" role="dialog" aria-modal="true">
          <div className="custom-modal-card card shadow-lg border-0 rounded-4 p-3 p-sm-4">
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-info-subtle text-info p-2 rounded-3">
                  <i className="bi bi-pin-map fs-5" />
                </span>
                <div>
                  <h3 className="h6 fw-bold mb-0">{t('farms.configureGpsTitle')}</h3>
                  <small className="text-muted">{locationModalFarm.name}</small>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setLocationModalFarm(null)}
                aria-label="Close"
              />
            </div>

            <form onSubmit={handleSaveLocation}>
              <div className="row g-2 mb-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold" htmlFor="modal-region">
                    {t('farms.stateRegionLabel')}
                  </label>
                  <input
                    id="modal-region"
                    className="form-control form-control-sm"
                    value={locationForm.region}
                    onChange={(e) => setLocationForm((p) => ({ ...p, region: e.target.value }))}
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold" htmlFor="modal-city">
                    {t('farms.cityDistrictLabel')}
                  </label>
                  <input
                    id="modal-city"
                    className="form-control form-control-sm"
                    value={locationForm.city}
                    onChange={(e) => setLocationForm((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>
              </div>

              <div className="card bg-light border-0 rounded-3 p-3 mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small fw-bold">{t('farms.gpsCoordinatesLabel')}</span>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm py-0 px-2 rounded-pill small"
                    onClick={() => handleDetectDeviceGps('locationModal')}
                    disabled={detectingGps}
                  >
                    {detectingGps ? 'Detecting…' : 'Detect GPS'}
                  </button>
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-12 col-sm-6">
                    <label className="form-label small text-muted mb-1" htmlFor="modal-lat">
                      Latitude
                    </label>
                    <input
                      id="modal-lat"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      inputMode="decimal"
                      className="form-control form-control-sm bg-white"
                      value={locationForm.latitude}
                      onChange={(e) => setLocationForm((p) => ({ ...p, latitude: e.target.value }))}
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label small text-muted mb-1" htmlFor="modal-lng">
                      Longitude
                    </label>
                    <input
                      id="modal-lng"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      inputMode="decimal"
                      className="form-control form-control-sm bg-white"
                      value={locationForm.longitude}
                      onChange={(e) => setLocationForm((p) => ({ ...p, longitude: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="pt-2 border-top">
                  <span className="text-muted small d-block mb-1" style={{ fontSize: '0.72rem' }}>
                    Presets:
                  </span>
                  <div className="d-flex flex-wrap gap-1">
                    {INDIAN_AGRI_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="btn btn-white btn-sm border py-0-5 px-2 rounded-2 small text-dark"
                        style={{ fontSize: '0.7rem' }}
                        onClick={() => handleApplyPreset(p, 'locationModal')}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setLocationModalFarm(null)}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary fw-semibold" disabled={locationSubmitting}>
                  {locationSubmitting ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default FarmsPage;
