import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { apiRequest } from '../lib/api.js';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../components/ui.jsx';
import { WeatherHistoryChart, SoilTelemetryChart } from '../components/charts/MonitoringCharts.jsx';

const SENSOR_TYPES = [
  { id: 'soil_moisture', label: 'Soil Moisture', unit: '%', icon: 'bi-droplet-half' },
  { id: 'soil_temperature', label: 'Soil Temperature', unit: '°C', icon: 'bi-thermometer-half' },
  { id: 'air_temperature', label: 'Air Temperature', unit: '°C', icon: 'bi-thermometer-sun' },
  { id: 'humidity', label: 'Ambient Humidity', unit: '%', icon: 'bi-moisture' },
  { id: 'rainfall', label: 'Rain Gauge', unit: 'mm', icon: 'bi-cloud-rain' },
];

export default function MonitoringPage() {
  const { token } = useAuth();
  const { t } = useLanguage();

  // Primary State
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [timeRange, setTimeRange] = useState('24h');

  // Weather State
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  const [weatherHistory, setWeatherHistory] = useState([]);

  // Telemetry & Sensors State
  const [sensors, setSensors] = useState([]);
  const [chartReadings, setChartReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsFilter, setAlertsFilter] = useState('all'); // 'all' | 'unacknowledged'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // Simulator State
  const [simulatorStatus, setSimulatorStatus] = useState({ running: false, intervalSeconds: 15 });
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatorLogs, setSimulatorLogs] = useState([]);
  const [simulatorDisabled, setSimulatorDisabled] = useState(false);

  // Modals & Forms
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [sensorReadings, setSensorReadings] = useState([]);
  const [readingsLoading, setReadingsLoading] = useState(false);

  const [sensorForm, setSensorForm] = useState({
    farmId: '',
    fieldId: '',
    name: '',
    type: 'soil_moisture',
    deviceUid: '',
    thresholdMin: 20,
    thresholdMax: 80,
    unit: '%',
  });

  const [ingestForm, setIngestForm] = useState({
    value: 35,
    unit: '%',
    batteryLevel: 95,
  });

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // 1. Fetch Fields for selected farm
  const loadFields = useCallback(async (farmId) => {
    if (!farmId) {
      setFields([]);
      return;
    }
    try {
      const res = await apiRequest(`/farms/${farmId}/fields`, { token });
      setFields(res.fields || []);
    } catch {
      setFields([]);
    }
  }, [token]);

  // 2. Fetch Live Weather & Weather History
  const loadWeather = useCallback(async (farmId, isManualRefresh = false) => {
    if (!farmId) return;
    if (isManualRefresh) setWeatherRefreshing(true);
    else setWeatherLoading(true);

    try {
      const [liveRes, histRes] = await Promise.all([
        apiRequest(`/weather/farms/${farmId}`, { token }),
        apiRequest(`/weather/farms/${farmId}/history?range=${timeRange}`, { token }).catch(() => ({ data: [] })),
      ]);
      setWeather(liveRes.data);
      setWeatherHistory(histRes.data || []);
      if (isManualRefresh) {
        setActionNotice('Live meteorological data and historical snapshot updated.');
      }
    } catch (err) {
      if (err.data?.message) {
        setWeather({ connected: false, message: err.data.message });
      } else {
        setWeather({ connected: false, message: err.message || 'Weather service unavailable.' });
      }
    } finally {
      setWeatherLoading(false);
      setWeatherRefreshing(false);
    }
  }, [token, timeRange]);

  // 3. Fetch Telemetry Readings for Charts
  const loadChartTelemetry = useCallback(async (farmId, fieldId, range) => {
    if (!farmId) return;
    try {
      let query = `/sensors/charts?farmId=${farmId}&range=${range}`;
      if (fieldId) query += `&fieldId=${fieldId}`;
      const res = await apiRequest(query, { token });
      setChartReadings(res.data || []);
    } catch {
      setChartReadings([]);
    }
  }, [token]);

  // 4. Fetch Active & Historical Alerts
  const loadAlerts = useCallback(async () => {
    try {
      const res = await apiRequest('/sensors/alerts', { token });
      setAlerts(res.data || []);
    } catch {
      setAlerts([]);
    }
  }, [token]);

  // 5. Fetch Simulator Status
  const loadSimulatorStatus = useCallback(async (farmId, fieldId) => {
    if (!farmId) return;
    try {
      const query = `/sensors/simulator/status?farmId=${farmId}${fieldId ? `&fieldId=${fieldId}` : ''}`;
      const res = await apiRequest(query, { token });
      setSimulatorStatus(res.data || { running: false, intervalSeconds: 15 });
      setSimulatorDisabled(false);
    } catch (err) {
      if (err.status === 403 || err.message?.includes('disabled in production')) {
        setSimulatorDisabled(true);
      }
      setSimulatorStatus({ running: false, intervalSeconds: 15 });
    }
  }, [token]);

  // Initial Load: Farms, Sensors, Alerts
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [farmRes, sensorRes] = await Promise.all([
        apiRequest('/farms', { token }),
        apiRequest('/sensors', { token }),
      ]);
      const farmList = farmRes.farms || [];
      setFarms(farmList);
      setSensors(sensorRes.data || []);

      if (farmList.length > 0) {
        const initialFarmId = selectedFarmId || farmList[0]._id;
        setSelectedFarmId(initialFarmId);
        setSensorForm((prev) => ({ ...prev, farmId: initialFarmId }));
        void loadFields(initialFarmId);
        void loadWeather(initialFarmId);
        void loadChartTelemetry(initialFarmId, selectedFieldId, timeRange);
        void loadSimulatorStatus(initialFarmId, selectedFieldId);
      }
      void loadAlerts();
    } catch (err) {
      setError(err.message || 'Failed to initialize monitoring module.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedFarmId, selectedFieldId, timeRange, loadFields, loadWeather, loadChartTelemetry, loadSimulatorStatus, loadAlerts]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // When selectedFarmId or timeRange or selectedFieldId changes
  useEffect(() => {
    if (selectedFarmId) {
      void loadWeather(selectedFarmId);
      void loadChartTelemetry(selectedFarmId, selectedFieldId, timeRange);
      void loadSimulatorStatus(selectedFarmId, selectedFieldId);
    }
  }, [selectedFarmId, selectedFieldId, timeRange, loadWeather, loadChartTelemetry, loadSimulatorStatus]);

  // Auto-refresh weather and telemetry interval (every 60 seconds)
  useEffect(() => {
    if (!selectedFarmId) return;
    const interval = setInterval(() => {
      void loadWeather(selectedFarmId);
      void loadChartTelemetry(selectedFarmId, selectedFieldId, timeRange);
      void loadAlerts();
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedFarmId, selectedFieldId, timeRange, loadWeather, loadChartTelemetry, loadAlerts]);

  // Handle Farm Change
  const handleFarmChange = (newFarmId) => {
    setSelectedFarmId(newFarmId);
    setSelectedFieldId('');
    setSensorForm((prev) => ({ ...prev, farmId: newFarmId, fieldId: '' }));
    void loadFields(newFarmId);
  };

  // ==================== SIMULATOR HANDLERS ====================
  const handleStartSimulation = async () => {
    if (!selectedFarmId) return;
    setSimulatorLoading(true);
    try {
      const res = await apiRequest('/sensors/simulator/start', {
        method: 'POST',
        token,
        body: {
          farmId: selectedFarmId,
          fieldId: selectedFieldId || undefined,
          intervalSeconds: simulatorStatus.intervalSeconds || 15,
          types: ['soil_moisture', 'soil_temperature'],
        },
      });
      setSimulatorStatus({
        running: true,
        intervalSeconds: res.session?.intervalSeconds || 15,
        startedAt: new Date().toISOString(),
      });
      setActionNotice(res.message || 'Sensor telemetry simulation started.');
      // Refresh telemetry & alerts
      void loadChartTelemetry(selectedFarmId, selectedFieldId, timeRange);
      void loadAlerts();
      const sRes = await apiRequest('/sensors', { token });
      setSensors(sRes.data || []);
    } catch (err) {
      if (err.status === 403) setSimulatorDisabled(true);
      setError(err.message || 'Failed to start simulator.');
    } finally {
      setSimulatorLoading(false);
    }
  };

  const handleStopSimulation = async () => {
    if (!selectedFarmId) return;
    setSimulatorLoading(true);
    try {
      const res = await apiRequest('/sensors/simulator/stop', {
        method: 'POST',
        token,
        body: {
          farmId: selectedFarmId,
          fieldId: selectedFieldId || undefined,
        },
      });
      setSimulatorStatus((prev) => ({ ...prev, running: false }));
      setActionNotice(res.message || 'Sensor telemetry simulation stopped.');
    } catch (err) {
      setError(err.message || 'Failed to stop simulator.');
    } finally {
      setSimulatorLoading(false);
    }
  };

  const handleTriggerTestReading = async (forceBreach = false) => {
    if (!selectedFarmId) return;
    setSimulatorLoading(true);
    try {
      const res = await apiRequest('/sensors/simulator/trigger', {
        method: 'POST',
        token,
        body: {
          farmId: selectedFarmId,
          fieldId: selectedFieldId || undefined,
          type: 'soil_moisture',
          forceBreach,
        },
      });
      const reading = res.data;
      setSimulatorLogs((prev) => [
        {
          id: Date.now(),
          type: reading.type,
          value: reading.value,
          unit: reading.unit,
          timestamp: reading.timestamp,
          alert: reading.alert,
          isSimulated: true,
        },
        ...prev.slice(0, 9),
      ]);

      setActionNotice(
        forceBreach
          ? `[SIMULATED] Threshold anomaly reading generated: ${reading.value}${reading.unit}. Alert created.`
          : `[SIMULATED] Telemetry reading generated: ${reading.value}${reading.unit}.`
      );

      // Refresh chart telemetry & alerts
      void loadChartTelemetry(selectedFarmId, selectedFieldId, timeRange);
      void loadAlerts();
      const sRes = await apiRequest('/sensors', { token });
      setSensors(sRes.data || []);
    } catch (err) {
      if (err.status === 403) setSimulatorDisabled(true);
      setError(err.message || 'Failed to trigger test reading.');
    } finally {
      setSimulatorLoading(false);
    }
  };

  // ==================== ALERTS HANDLER ====================
  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await apiRequest(`/sensors/alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
        token,
      });
      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a))
      );
      setActionNotice('Alert acknowledged successfully.');
    } catch (err) {
      setError(err.message || 'Failed to acknowledge alert.');
    }
  };

  // ==================== SENSOR CRUD ====================
  const handleOpenRegister = () => {
    setSensorForm({
      farmId: selectedFarmId || (farms[0]?._id || ''),
      fieldId: selectedFieldId || '',
      name: '',
      type: 'soil_moisture',
      deviceUid: `SN-IOT-${Math.floor(1000 + Math.random() * 9000)}`,
      thresholdMin: 20,
      thresholdMax: 80,
      unit: '%',
    });
    setModalError('');
    setShowRegisterModal(true);
  };

  const handleSaveSensor = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    try {
      await apiRequest('/sensors', {
        method: 'POST',
        token,
        body: {
          farmId: sensorForm.farmId,
          fieldId: sensorForm.fieldId || undefined,
          name: sensorForm.name,
          type: sensorForm.type,
          deviceUid: sensorForm.deviceUid,
          thresholds: {
            min: Number(sensorForm.thresholdMin),
            max: Number(sensorForm.thresholdMax),
            unit: sensorForm.unit,
          },
        },
      });
      setShowRegisterModal(false);
      setActionNotice(`Sensor "${sensorForm.name}" registered successfully.`);
      const sensorRes = await apiRequest('/sensors', { token });
      setSensors(sensorRes.data || []);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSensor = async (sensor) => {
    if (!window.confirm(`Are you sure you want to unregister sensor "${sensor.name}"?`)) return;
    try {
      await apiRequest(`/sensors/${sensor._id}`, {
        method: 'DELETE',
        token,
      });
      setActionNotice(`Sensor "${sensor.name}" unregistered.`);
      const sensorRes = await apiRequest('/sensors', { token });
      setSensors(sensorRes.data || []);
      if (selectedSensor?._id === sensor._id) {
        setSelectedSensor(null);
        setSensorReadings([]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectSensor = async (sensor) => {
    setSelectedSensor(sensor);
    setReadingsLoading(true);
    try {
      const res = await apiRequest(`/sensors/${sensor._id}/readings?limit=50`, { token });
      setSensorReadings(res.data || []);
    } catch {
      setSensorReadings([]);
    } finally {
      setReadingsLoading(false);
    }
  };

  const handleOpenIngest = (sensor) => {
    setSelectedSensor(sensor);
    setIngestForm({
      value: sensor.thresholds?.min ? sensor.thresholds.min + 5 : 30,
      unit: sensor.thresholds?.unit || '%',
      batteryLevel: 98,
    });
    setModalError('');
    setShowIngestModal(true);
  };

  const handleSendTelemetry = async (e) => {
    e.preventDefault();
    if (!selectedSensor) return;
    setSubmitting(true);
    setModalError('');
    try {
      await apiRequest(`/sensors/${selectedSensor._id}/readings`, {
        method: 'POST',
        token,
        body: ingestForm,
      });
      setShowIngestModal(false);
      setActionNotice(`Telemetry packet recorded for "${selectedSensor.name}".`);

      const [sensorRes, readingRes] = await Promise.all([
        apiRequest('/sensors', { token }),
        apiRequest(`/sensors/${selectedSensor._id}/readings?limit=50`, { token }),
      ]);
      setSensors(sensorRes.data || []);
      setSensorReadings(readingRes.data || []);
      void loadChartTelemetry(selectedFarmId, selectedFieldId, timeRange);
      void loadAlerts();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedFarmObj = farms.find((f) => f._id === selectedFarmId);
  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const displayedAlerts = alertsFilter === 'unacknowledged' ? activeAlerts : alerts;

  return (
    <div className="monitoring-page-wrap pb-5">
      <PageHeader
        eyebrow={t('monitoring.eyebrow')}
        title={t('monitoring.title')}
        description={t('monitoring.description')}
        actions={
          <div className="d-flex gap-2 align-items-center flex-wrap">
            {farms.length > 0 && (
              <select
                id="monitoring-farm-select"
                className="form-select form-select-sm"
                style={{ width: 'auto', minWidth: '180px' }}
                value={selectedFarmId}
                onChange={(e) => handleFarmChange(e.target.value)}
              >
                {farms.map((f) => (
                  <option key={f._id} value={f._id}>
                    Farm: {f.name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="primary" className="btn-sm" onClick={handleOpenRegister}>
              <i className="bi bi-plus-lg me-1" /> {t('monitoring.registerSensor')}
            </Button>
          </div>
        }
      />

      {actionNotice && (
        <div className="alert alert-success alert-dismissible py-2 px-3 small mb-3 shadow-sm" role="status">
          <i className="bi bi-check-circle-fill me-2" />
          <span>{actionNotice}</span>
          <button
            type="button"
            className="btn-close py-2"
            aria-label="Dismiss notice"
            onClick={() => setActionNotice('')}
          />
        </div>
      )}

      {error && <ErrorState message={error} onRetry={loadInitialData} />}

      {/* 1. TOP SUMMARY CARDS ROW */}
      <div className="row g-3 mb-4">
        {/* Weather Summary Card */}
        <div className="col-12 col-md-4">
          <Card className="p-3 h-100 bg-white shadow-sm border-0 position-relative overflow-hidden">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted small fw-semibold text-uppercase tracking-wider">
                {t('monitoring.liveWeather')}
              </span>
              {weather?.stale ? (
                <span className="badge bg-warning text-dark border">
                  <i className="bi bi-clock-history me-1" /> STALE
                </span>
              ) : weather?.connected ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  <i className="bi bi-broadcast me-1" /> LIVE
                </span>
              ) : (
                <span className="badge bg-secondary-subtle text-secondary">OFFLINE</span>
              )}
            </div>
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <span className="display-6 fw-bold text-dark">
                {weather?.temperature !== undefined ? `${Math.round(weather.temperature)}°C` : '—'}
              </span>
              <span className="text-muted fs-6 text-capitalize">
                {weather?.condition || weather?.current?.condition || 'Awaiting Sync'}
              </span>
            </div>
            <div className="text-muted small d-flex gap-3 mt-2 pt-2 border-top">
              <span>
                <i className="bi bi-moisture me-1 text-primary" />
                {weather?.humidity ?? weather?.current?.humidity ?? '—'}%
              </span>
              <span>
                <i className="bi bi-cloud-rain me-1 text-info" />
                {weather?.precipitation ?? weather?.current?.precipitation ?? 0} mm
              </span>
              <span>
                <i className="bi bi-wind me-1 text-secondary" />
                {weather?.windSpeed ?? weather?.current?.windSpeed ?? 0} km/h
              </span>
            </div>
          </Card>
        </div>

        {/* Sensor Health Card */}
        <div className="col-12 col-md-4">
          <Card className="p-3 h-100 bg-white shadow-sm border-0">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted small fw-semibold text-uppercase tracking-wider">
                Field Sensors Connected
              </span>
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                {sensors.filter((s) => s.status === 'active').length} Active
              </span>
            </div>
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <span className="display-6 fw-bold text-dark">{sensors.length}</span>
              <span className="text-muted fs-6">Gateways & Probes</span>
            </div>
            <div className="text-muted small d-flex justify-content-between mt-2 pt-2 border-top">
              <span>
                Simulated:{' '}
                <strong className="text-warning-emphasis">
                  {sensors.filter((s) => s.isSimulated || s.source === 'simulated').length}
                </strong>
              </span>
              <span>
                Physical:{' '}
                <strong className="text-success">
                  {sensors.filter((s) => !s.isSimulated && s.source !== 'simulated').length}
                </strong>
              </span>
              <span>
                Alerts Debounce: <strong className="text-secondary">30m</strong>
              </span>
            </div>
          </Card>
        </div>

        {/* Active Threshold Alerts Card */}
        <div className="col-12 col-md-4">
          <Card className="p-3 h-100 bg-white shadow-sm border-0">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted small fw-semibold text-uppercase tracking-wider">
                Active Threshold Breaches
              </span>
              {activeAlerts.length > 0 ? (
                <span className="badge bg-danger text-white">
                  <i className="bi bi-exclamation-triangle-fill me-1" /> ATTENTION
                </span>
              ) : (
                <span className="badge bg-success-subtle text-success">NOMINAL</span>
              )}
            </div>
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <span className={`display-6 fw-bold ${activeAlerts.length > 0 ? 'text-danger' : 'text-success'}`}>
                {activeAlerts.length}
              </span>
              <span className="text-muted fs-6">Unacknowledged</span>
            </div>
            <div className="text-muted small d-flex justify-content-between mt-2 pt-2 border-top">
              <span>
                Critical: <strong>{activeAlerts.filter((a) => a.severity === 'critical').length}</strong>
              </span>
              <span>
                Warning: <strong>{activeAlerts.filter((a) => a.severity === 'warning').length}</strong>
              </span>
              <span>
                Total Recorded: <strong>{alerts.length}</strong>
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* 2. REAL WEATHER INTEGRATION SECTION */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <h2 className="h5 mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-cloud-sun text-warning fs-4" />
              <span>{t('monitoring.liveWeather')}</span>
            </h2>
            {weather?.provider && (
              <span className="badge bg-light text-secondary border">
                Provider: <strong>{weather.provider}</strong>
              </span>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-success"
              className="btn-sm"
              disabled={weatherRefreshing || !selectedFarmId}
              onClick={() => loadWeather(selectedFarmId, true)}
            >
              <i className={`bi bi-arrow-clockwise me-1 ${weatherRefreshing ? 'spin-animation' : ''}`} />
              {weatherRefreshing ? t('monitoring.refreshing') : t('monitoring.refreshWeather')}
            </Button>
          </div>
        </div>

        {weatherLoading ? (
          <Card className="p-4">
            <LoadingState>Retrieving meteorological observations from Open-Meteo…</LoadingState>
          </Card>
        ) : weather?.connected ? (
          <Card className="p-4 border-0 shadow-sm">
            {/* Stale data warning banner */}
            {weather.stale && (
              <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-5 text-warning" />
                <div>
                  <strong>{t('monitoring.staleWarning')}</strong>
                  <div className="text-muted">{weather.staleReason}</div>
                </div>
              </div>
            )}

            <div className="row g-4 align-items-center">
              <div className="col-12 col-md-4 border-end">
                <span className="text-muted small d-block">
                  {selectedFarmObj?.name} (Lat: {weather.location?.latitude?.toFixed(4)}°, Lon:{' '}
                  {weather.location?.longitude?.toFixed(4)}°)
                </span>
                <div className="d-flex align-items-center gap-3 my-2">
                  <span className="display-4 fw-bold text-success mb-0">
                    {weather.current?.temperature !== undefined
                      ? `${Math.round(weather.current.temperature)}°C`
                      : `${Math.round(weather.temperature || 0)}°C`}
                  </span>
                  <div>
                    <strong className="d-block text-capitalize fs-5">
                      {weather.current?.condition || weather.condition}
                    </strong>
                    <small className="text-muted">
                      Feels like {Math.round(weather.current?.apparentTemperature || weather.apparentTemperature || 0)}°C
                    </small>
                  </div>
                </div>
                <div className="text-muted small">
                  {t('monitoring.lastUpdated')}:{' '}
                  {weather.updatedAt ? new Date(weather.updatedAt).toLocaleTimeString() : 'Just now'}
                </div>
              </div>

              <div className="col-12 col-md-8">
                <div className="row g-2 text-center mb-3">
                  <div className="col-6 col-sm-3">
                    <div className="p-2 bg-light rounded">
                      <small className="text-muted d-block">{t('monitoring.humidity')}</small>
                      <strong className="fs-6">{weather.current?.humidity ?? weather.humidity}%</strong>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 bg-light rounded">
                      <small className="text-muted d-block">{t('monitoring.rainfall')}</small>
                      <strong className="fs-6">{weather.current?.precipitation ?? weather.precipitation ?? 0} mm</strong>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 bg-light rounded">
                      <small className="text-muted d-block">{t('monitoring.windSpeed')}</small>
                      <strong className="fs-6">{weather.current?.windSpeed ?? weather.windSpeed ?? 0} km/h</strong>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 bg-light rounded">
                      <small className="text-muted d-block">{t('monitoring.elevation')}</small>
                      <strong className="fs-6">{weather.location?.elevation || 0} m</strong>
                    </div>
                  </div>
                </div>

                {/* 24-Hour Hourly Forecast Carousel */}
                {weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
                  <div>
                    <span className="small text-muted fw-bold d-block mb-1">
                      <i className="bi bi-clock me-1 text-primary" />
                      {t('monitoring.hourlyForecast')}
                    </span>
                    <div className="d-flex gap-2 overflow-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                      {weather.hourlyForecast.slice(0, 24).map((hour, idx) => {
                        const timeStr = hour.time ? new Date(hour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${idx}:00`;
                        return (
                          <div
                            key={idx}
                            className="p-2 border rounded text-center flex-shrink-0"
                            style={{ minWidth: '78px', background: '#fafbfc' }}
                          >
                            <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                              {timeStr}
                            </small>
                            <div className="fw-bold text-success my-1">
                              {hour.temperature !== undefined ? `${Math.round(hour.temperature)}°` : '—'}
                            </div>
                            <small className="text-primary d-block" style={{ fontSize: '0.68rem' }}>
                              <i className="bi bi-droplet me-1" />
                              {hour.precipitationProbability || 0}%
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 7-Day Forecast Cards */}
            {weather.dailyForecast && weather.dailyForecast.length > 0 && (
              <div className="mt-3 pt-3 border-top">
                <span className="small text-muted fw-bold d-block mb-2">
                  <i className="bi bi-calendar-week me-1 text-success" />
                  {t('monitoring.sevenDayForecast')}
                </span>
                <div className="row g-2">
                  {weather.dailyForecast.map((day, idx) => {
                    const dayName = new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                      <div key={idx} className="col-6 col-md-3 col-lg">
                        <div className="p-2 border rounded text-center h-100 bg-light">
                          <small className="fw-bold d-block text-secondary">{dayName}</small>
                          <div className="my-1">
                            <span className="text-danger fw-bold">{Math.round(day.maxTemp)}°</span>{' '}
                            <span className="text-muted small">/ {Math.round(day.minTemp)}°</span>
                          </div>
                          <small className="d-block text-truncate text-muted" style={{ fontSize: '0.72rem' }}>
                            {day.condition}
                          </small>
                          {day.precipitationSum > 0 && (
                            <small className="badge bg-primary-subtle text-primary mt-1" style={{ fontSize: '0.65rem' }}>
                              {day.precipitationSum} mm
                            </small>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-4 bg-light border-0">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-geo-alt-fill fs-2 text-warning" />
              <div>
                <strong className="d-block">Weather Geolocation Notice</strong>
                <p className="mb-0 text-muted small">
                  {weather?.message ||
                    'Coordinates are unconfigured for this farm. Edit farm details to provide latitude and longitude coordinates for genuine live local meteorological data.'}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* 3. HISTORICAL DATA CHARTS & FILTERS SECTION */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <span className="eyebrow">Persisted Historical Analytics</span>
            <h2 className="h5 mb-0">Environmental & Soil Telemetry Trends</h2>
          </div>

          <div className="d-flex gap-2 align-items-center flex-wrap">
            {/* Field Filter */}
            {fields.length > 0 && (
              <select
                id="monitoring-field-filter"
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
              >
                <option value="">{t('monitoring.allFields')}</option>
                {fields.map((f) => (
                  <option key={f._id} value={f._id}>
                    Field: {f.name}
                  </option>
                ))}
              </select>
            )}

            {/* Time Range Tabs */}
            <div className="btn-group btn-group-sm" role="group" aria-label="Time range selector">
              <button
                type="button"
                className={`btn ${timeRange === '24h' ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={() => setTimeRange('24h')}
              >
                {t('monitoring.range24h')}
              </button>
              <button
                type="button"
                className={`btn ${timeRange === '7d' ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={() => setTimeRange('7d')}
              >
                {t('monitoring.range7d')}
              </button>
              <button
                type="button"
                className={`btn ${timeRange === '30d' ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={() => setTimeRange('30d')}
              >
                {t('monitoring.range30d')}
              </button>
            </div>
          </div>
        </div>

        <div className="row g-3">
          {/* Weather History Line Chart */}
          <div className="col-12 col-lg-6">
            <Card className="p-3 h-100 shadow-sm border-0">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong className="fs-6 d-flex align-items-center gap-2">
                  <i className="bi bi-graph-up text-warning" />
                  {t('monitoring.weatherHistory')}
                </strong>
                <span className="badge bg-light text-secondary border">Open-Meteo Snapshots</span>
              </div>
              <WeatherHistoryChart data={weatherHistory} timeRange={timeRange} />
            </Card>
          </div>

          {/* Soil Telemetry Line Chart */}
          <div className="col-12 col-lg-6">
            <Card className="p-3 h-100 shadow-sm border-0">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong className="fs-6 d-flex align-items-center gap-2">
                  <i className="bi bi-activity text-success" />
                  {t('monitoring.sensorHistory')}
                </strong>
                <span className="badge bg-light text-secondary border">Telemetry Stream</span>
              </div>
              <SoilTelemetryChart readings={chartReadings} sensors={sensors} timeRange={timeRange} />
            </Card>
          </div>
        </div>
      </div>

      {/* 4. DEVELOPMENT-ONLY SENSOR SIMULATOR CONTROL CENTER */}
      <div className="mb-4">
        <Card className="p-4 border-0 shadow-sm bg-gradient" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge bg-warning text-dark fw-bold">
                  <i className="bi bi-cpu-fill me-1" />
                  DEVELOPMENT ONLY
                </span>
                <span className="badge bg-light text-secondary border">
                  Strictly Disabled in Production
                </span>
              </div>
              <h3 className="h5 mb-1">{t('monitoring.simulatorTitle')}</h3>
              <p className="text-muted small mb-0">{t('monitoring.simulatorDescription')}</p>
            </div>

            {/* Status indicator */}
            <div className="d-flex align-items-center gap-2">
              <span
                className={`badge py-2 px-3 ${
                  simulatorStatus.running
                    ? 'bg-success text-white'
                    : 'bg-secondary text-white'
                }`}
              >
                <i className={`bi bi-circle-fill me-1 ${simulatorStatus.running ? 'pulse' : ''}`} />
                {simulatorStatus.running ? t('monitoring.statusRunning') : t('monitoring.statusStopped')}
              </span>
            </div>
          </div>

          {simulatorDisabled ? (
            <div className="alert alert-secondary py-2 small mb-0">
              <i className="bi bi-shield-lock-fill me-1" />
              {t('monitoring.simulatorDisabledProd')}
            </div>
          ) : (
            <div>
              <div className="d-flex gap-2 flex-wrap align-items-center pt-2 border-top">
                {simulatorStatus.running ? (
                  <Button
                    variant="outline-danger"
                    className="btn-sm"
                    disabled={simulatorLoading}
                    onClick={handleStopSimulation}
                  >
                    <i className="bi bi-stop-circle me-1" />
                    {t('monitoring.stopSimulator')}
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    className="btn-sm"
                    disabled={simulatorLoading || !selectedFarmId}
                    onClick={handleStartSimulation}
                  >
                    <i className="bi bi-play-circle me-1" />
                    {t('monitoring.startSimulator')} (15s interval)
                  </Button>
                )}

                <Button
                  variant="outline-secondary"
                  className="btn-sm"
                  disabled={simulatorLoading || !selectedFarmId}
                  onClick={() => handleTriggerTestReading(false)}
                >
                  <i className="bi bi-send-plus me-1 text-primary" />
                  {t('monitoring.triggerReading')}
                </Button>

                <Button
                  variant="outline-warning"
                  className="btn-sm text-dark"
                  disabled={simulatorLoading || !selectedFarmId}
                  onClick={() => handleTriggerTestReading(true)}
                >
                  <i className="bi bi-exclamation-diamond-fill me-1 text-danger" />
                  {t('monitoring.triggerBreach')} (Alert Test)
                </Button>
              </div>

              {/* Live simulator activity feed */}
              {simulatorLogs.length > 0 && (
                <div className="mt-3 pt-3 border-top">
                  <span className="small text-muted fw-bold d-block mb-1">Recent Simulator Activity:</span>
                  <div className="d-flex gap-2 flex-wrap">
                    {simulatorLogs.map((log) => (
                      <span
                        key={log.id}
                        className={`badge p-2 small border ${
                          log.alert ? 'bg-danger-subtle text-danger border-danger' : 'bg-light text-dark'
                        }`}
                      >
                        [SIMULATED] {log.type}: <strong>{log.value}{log.unit}</strong>{' '}
                        {log.alert && <i className="bi bi-exclamation-triangle ms-1" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* 5. THRESHOLD ALERTS & ANOMALY CENTER */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <span className="eyebrow">Anomaly Detection & Safeguards</span>
            <h2 className="h5 mb-0">{t('monitoring.alertsTitle')} ({activeAlerts.length} Active)</h2>
          </div>

          <div className="btn-group btn-group-sm" role="group">
            <button
              type="button"
              className={`btn ${alertsFilter === 'all' ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setAlertsFilter('all')}
            >
              All Alerts ({alerts.length})
            </button>
            <button
              type="button"
              className={`btn ${alertsFilter === 'unacknowledged' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => setAlertsFilter('unacknowledged')}
            >
              Active / Unacknowledged ({activeAlerts.length})
            </button>
          </div>
        </div>

        {displayedAlerts.length === 0 ? (
          <Card className="p-4 text-center bg-white shadow-sm border-0">
            <i className="bi bi-shield-check fs-2 text-success mb-2 d-block" />
            <strong>{t('monitoring.noAlerts')}</strong>
            <p className="text-muted small mb-0 mt-1">
              Threshold violations (e.g. soil moisture deficit below 25%) will automatically trigger alerts here.
            </p>
          </Card>
        ) : (
          <div className="row g-2">
            {displayedAlerts.map((alert) => {
              const isCrit = alert.severity === 'critical';
              return (
                <div key={alert._id} className="col-12">
                  <Card
                    className={`p-3 border-0 shadow-sm ${
                      alert.acknowledged
                        ? 'bg-light text-muted'
                        : isCrit
                        ? 'border-start border-danger border-4'
                        : 'border-start border-warning border-4'
                    }`}
                  >
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                      <div className="d-flex align-items-start gap-2">
                        <i
                          className={`bi ${
                            alert.acknowledged
                              ? 'bi-check-circle-fill text-muted'
                              : isCrit
                              ? 'bi-exclamation-octagon-fill text-danger fs-5'
                              : 'bi-exclamation-triangle-fill text-warning fs-5'
                          }`}
                        />
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <strong className="text-dark">{alert.title}</strong>
                            <span
                              className={`badge ${
                                isCrit ? 'bg-danger' : 'bg-warning text-dark'
                              }`}
                              style={{ fontSize: '0.7rem' }}
                            >
                              {alert.severity ? alert.severity.toUpperCase() : 'WARNING'}
                            </span>
                            {alert.isSimulated && (
                              <span className="badge bg-warning-subtle text-dark border border-warning" style={{ fontSize: '0.65rem' }}>
                                [SIMULATED]
                              </span>
                            )}
                          </div>
                          <p className="small mb-1 text-secondary">{alert.message}</p>
                          <small className="text-muted">
                            Triggered: {new Date(alert.createdAt).toLocaleString()}
                            {alert.acknowledged && alert.acknowledgedAt && (
                              <span> • Acknowledged: {new Date(alert.acknowledgedAt).toLocaleString()}</span>
                            )}
                          </small>
                        </div>
                      </div>

                      {!alert.acknowledged && (
                        <Button
                          variant="outline-success"
                          className="btn-sm"
                          onClick={() => handleAcknowledgeAlert(alert._id)}
                        >
                          <i className="bi bi-check-lg me-1" />
                          {t('monitoring.acknowledgeAlert')}
                        </Button>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. REGISTERED FIELD SENSORS & TELEMETRY STREAM */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <span className="eyebrow">Physical & Simulated IoT Hardware</span>
            <h2 className="h5 mb-0">Registered Field Sensors ({sensors.length})</h2>
          </div>
          <Button variant="outline-success" className="btn-sm" onClick={handleOpenRegister}>
            <i className="bi bi-plus-lg me-1" /> Register New Gateway / Sensor
          </Button>
        </div>

        {loading ? (
          <LoadingState>Loading sensor devices…</LoadingState>
        ) : sensors.length === 0 ? (
          <Card className="p-4 border-0 shadow-sm">
            <EmptyState
              icon="bi-broadcast-pin"
              title="No field sensors connected yet"
              description="Connect LoRaWAN gateways, soil moisture probes, or field weather stations. Registered sensors record timestamped readings and alert you when thresholds are breached."
              action={
                <Button variant="primary" onClick={handleOpenRegister}>
                  <i className="bi bi-plus-lg me-1" /> Register First Field Sensor
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="row g-3">
            {sensors.map((sensor) => {
              const sensorTypeInfo = SENSOR_TYPES.find((t) => t.id === sensor.type) || SENSOR_TYPES[0];
              const isSelected = selectedSensor?._id === sensor._id;
              const farmObj = farms.find((f) => f._id === sensor.farmId);
              const fieldObj = fields.find((f) => f._id === sensor.fieldId);
              const isSim = sensor.isSimulated || sensor.source === 'simulated';

              return (
                <div key={sensor._id} className="col-12 col-md-6 col-lg-4">
                  <Card
                    className={`p-3 h-100 border-0 shadow-sm ${isSelected ? 'ring-2 ring-success' : ''}`}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onClick={() => handleSelectSensor(sensor)}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="p-2 rounded bg-success-subtle text-success">
                          <i className={`bi ${sensorTypeInfo.icon} fs-5`} />
                        </span>
                        <div>
                          <strong className="d-block">{sensor.name}</strong>
                          <small className="text-muted">{sensorTypeInfo.label}</small>
                        </div>
                      </div>
                      <div className="d-flex flex-column align-items-end gap-1">
                        <span className={`badge ${sensor.status === 'active' ? 'bg-success' : 'bg-secondary'}`}>
                          {sensor.status}
                        </span>
                        <span
                          className={`badge ${isSim ? 'bg-warning text-dark' : 'bg-success-subtle text-success border'}`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          {isSim ? 'SIMULATED' : 'PHYSICAL'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-light p-2 rounded small mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Device UID:</span>
                        <code>{sensor.deviceUid}</code>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Farm / Field:</span>
                        <span>{farmObj?.name || 'Farm'}{fieldObj ? ` / ${fieldObj.name}` : ''}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Thresholds:</span>
                        <span>
                          {sensor.thresholds?.min ?? '—'} - {sensor.thresholds?.max ?? '—'} {sensor.thresholds?.unit}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Last Transmission:</span>
                        <span>
                          {sensor.lastReadingAt
                            ? new Date(sensor.lastReadingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Awaiting packet'}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          title="Simulate / Record Telemetry Packet"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenIngest(sensor);
                          }}
                        >
                          <i className="bi bi-send-check me-1" /> Ingest
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Unregister Sensor"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSensor(sensor);
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                      <small className="text-muted">
                        <i className="bi bi-battery-charging me-1 text-success" />
                        {sensor.batteryLevel || 100}%
                      </small>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SELECTED SENSOR TELEMETRY READINGS TIMELINE */}
      {selectedSensor && (
        <Card className="p-4 mb-4 border-0 shadow-sm">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <span className="eyebrow">Telemetry Data Stream</span>
              <h3 className="h5 mb-0">Recent Readings for: {selectedSensor.name}</h3>
              <small className="text-muted">UID: {selectedSensor.deviceUid}</small>
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-success" className="btn-sm" onClick={() => handleOpenIngest(selectedSensor)}>
                <i className="bi bi-send me-1" /> Send Test Reading
              </Button>
              <Button variant="outline-secondary" className="btn-sm" onClick={() => setSelectedSensor(null)}>
                Close Panel
              </Button>
            </div>
          </div>

          {readingsLoading ? (
            <LoadingState>Loading sensor telemetry time-series…</LoadingState>
          ) : sensorReadings.length === 0 ? (
            <div className="p-4 text-center text-muted bg-light rounded">
              <i className="bi bi-broadcast fs-2 mb-2 d-block text-secondary" />
              <strong>No readings recorded yet for this sensor.</strong>
              <p className="small mb-2">Use the "Send Test Reading" button or transmit genuine LoRaWAN payload to:</p>
              <code>POST /api/sensors/{selectedSensor._id}/readings</code>
            </div>
          ) : (
            <DataTable
              headers={['Timestamp', 'Value Recorded', 'Unit', 'Source', 'Threshold Status']}
              label="Sensor readings log"
            >
              {sensorReadings.map((r) => {
                const isOutOfRange =
                  selectedSensor.thresholds &&
                  ((selectedSensor.thresholds.min !== undefined && r.value < selectedSensor.thresholds.min) ||
                    (selectedSensor.thresholds.max !== undefined && r.value > selectedSensor.thresholds.max));
                const isSim = r.isSimulated || r.source === 'simulated';

                return (
                  <tr key={r._id}>
                    <td>{new Date(r.timestamp).toLocaleString()}</td>
                    <td>
                      <strong className="fs-6">{r.value}</strong>
                    </td>
                    <td>{r.unit}</td>
                    <td>
                      <span className={`badge ${isSim ? 'bg-warning text-dark' : 'bg-success text-white'}`} style={{ fontSize: '0.65rem' }}>
                        {isSim ? 'SIMULATED' : 'PHYSICAL'}
                      </span>
                    </td>
                    <td>
                      {isOutOfRange ? (
                        <Badge tone="amber">
                          <i className="bi bi-exclamation-triangle-fill me-1" /> Anomaly / Threshold Exceeded
                        </Badge>
                      ) : (
                        <Badge tone="green">Normal Range</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      )}

      {/* REGISTER SENSOR MODAL */}
      {showRegisterModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-broadcast me-2" />
                  Register Telemetry Device / Gateway
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowRegisterModal(false)}
                />
              </div>
              <form onSubmit={handleSaveSensor}>
                <div className="modal-body">
                  {modalError && <div className="alert alert-danger py-2 small">{modalError}</div>}

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="sns-farm">
                        Farm *
                      </label>
                      <select
                        id="sns-farm"
                        className="form-select"
                        value={sensorForm.farmId}
                        required
                        onChange={(e) => {
                          const fId = e.target.value;
                          setSensorForm({ ...sensorForm, farmId: fId });
                          void loadFields(fId);
                        }}
                      >
                        {farms.map((f) => (
                          <option key={f._id} value={f._id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="sns-field">
                        Field (Optional)
                      </label>
                      <select
                        id="sns-field"
                        className="form-select"
                        value={sensorForm.fieldId}
                        onChange={(e) => setSensorForm({ ...sensorForm, fieldId: e.target.value })}
                      >
                        <option value="">Farm General</option>
                        {fields.map((fld) => (
                          <option key={fld._id} value={fld._id}>
                            {fld.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="sns-name">
                      Sensor / Station Name *
                    </label>
                    <input
                      id="sns-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. South Field Soil Probe 1"
                      value={sensorForm.name}
                      required
                      onChange={(e) => setSensorForm({ ...sensorForm, name: e.target.value })}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="sns-type">
                        Telemetry Type *
                      </label>
                      <select
                        id="sns-type"
                        className="form-select"
                        value={sensorForm.type}
                        required
                        onChange={(e) => {
                          const typeId = e.target.value;
                          const tInfo = SENSOR_TYPES.find((t) => t.id === typeId);
                          setSensorForm({
                            ...sensorForm,
                            type: typeId,
                            unit: tInfo ? tInfo.unit : '%',
                          });
                        }}
                      >
                        {SENSOR_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} ({t.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="sns-uid">
                        Device UID / Serial *
                      </label>
                      <input
                        id="sns-uid"
                        type="text"
                        className="form-control"
                        placeholder="e.g. SN-SOIL-1049"
                        value={sensorForm.deviceUid}
                        required
                        onChange={(e) => setSensorForm({ ...sensorForm, deviceUid: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-4">
                      <label className="form-label" htmlFor="sns-min">
                        Min Threshold
                      </label>
                      <input
                        id="sns-min"
                        type="number"
                        step="any"
                        className="form-control"
                        value={sensorForm.thresholdMin}
                        onChange={(e) => setSensorForm({ ...sensorForm, thresholdMin: e.target.value })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label" htmlFor="sns-max">
                        Max Threshold
                      </label>
                      <input
                        id="sns-max"
                        type="number"
                        step="any"
                        className="form-control"
                        value={sensorForm.thresholdMax}
                        onChange={(e) => setSensorForm({ ...sensorForm, thresholdMax: e.target.value })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label" htmlFor="sns-unit">
                        Unit
                      </label>
                      <input
                        id="sns-unit"
                        type="text"
                        className="form-control"
                        value={sensorForm.unit}
                        onChange={(e) => setSensorForm({ ...sensorForm, unit: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Button variant="outline-secondary" onClick={() => setShowRegisterModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={submitting}>
                    {submitting ? 'Registering…' : 'Save Sensor'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TELEMETRY PACKET INGEST MODAL */}
      {showIngestModal && selectedSensor && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-send-check me-2" />
                  Transmit Telemetry Packet
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowIngestModal(false)}
                />
              </div>
              <form onSubmit={handleSendTelemetry}>
                <div className="modal-body">
                  {modalError && <div className="alert alert-danger py-2 small">{modalError}</div>}
                  <div className="alert alert-light border small mb-3">
                    Target Sensor: <strong>{selectedSensor.name}</strong> ({selectedSensor.deviceUid})
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="ingest-val">
                      Value Recorded ({ingestForm.unit}) *
                    </label>
                    <input
                      id="ingest-val"
                      type="number"
                      step="any"
                      className="form-control"
                      value={ingestForm.value}
                      required
                      onChange={(e) => setIngestForm({ ...ingestForm, value: Number(e.target.value) })}
                    />
                    <small className="text-muted">
                      Threshold guidelines: Min {selectedSensor.thresholds?.min ?? '—'} / Max{' '}
                      {selectedSensor.thresholds?.max ?? '—'}
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="ingest-batt">
                      Battery Level (%)
                    </label>
                    <input
                      id="ingest-batt"
                      type="number"
                      min="1"
                      max="100"
                      className="form-control"
                      value={ingestForm.batteryLevel}
                      onChange={(e) => setIngestForm({ ...ingestForm, batteryLevel: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <Button variant="outline-secondary" onClick={() => setShowIngestModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="success" type="submit" disabled={submitting}>
                    {submitting ? 'Recording…' : 'Record Telemetry'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
